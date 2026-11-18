"""Original royalty-free background track for story reels (synthesised, no licensing issues).
  python3 scripts/gen_bgm.py --spec content/stories/X.json --out /tmp/bgm.wav [--mood curious|upbeat]
Beat-synced: pad+bass+pluck+soft drums, riser into the 'twist' scene, a chime on the reveal, fade at the end."""
import argparse, json, numpy as np, soundfile as sf
SR = 44100
def note(f): return 440 * 2 ** ((f - 69) / 12)
def tone(f, d, kind="sine", att=0.01, rel=0.2):
    t = np.arange(int(d * SR)) / SR
    w = np.sin(2*np.pi*f*t) if kind == "sine" else 2*np.abs(2*((f*t) % 1)-1)-1
    if kind == "pad": w = (np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*1.005*t)+0.3*np.sin(2*np.pi*f*2*t))/1.8
    env = np.minimum(1, t/att) * np.minimum(1, np.maximum(0, (d-t)/rel))
    return w * env
def put(buf, x, at):
    i = int(at*SR); n = min(len(x), len(buf)-i)
    if n > 0 and i >= 0: buf[i:i+n] += x[:n]
ap = argparse.ArgumentParser(); ap.add_argument("--spec", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--mood", default="curious"); a = ap.parse_args()
sp = json.load(open(a.spec)); durs = [s["dur"] for s in sp["scenes"]]; total = sum(durs)
bpm = 96 if a.mood == "curious" else 118; beat = 60/bpm
chords = [(57,60,64),(53,57,60),(48,52,55),(55,59,62)] if a.mood == "curious" else [(60,64,67),(55,59,62),(57,60,64),(53,57,60)]
buf = np.zeros(int((total+1)*SR), dtype=np.float32); rng = np.random.default_rng(3)
bar = 4*beat; nb = int(total/bar)+1
for b in range(nb):
    c = chords[b % 4]; t0 = b*bar
    for n_ in c: put(buf, 0.10*tone(note(n_), bar, "pad", 0.25, 0.4), t0)
    put(buf, 0.22*tone(note(c[0]-12), bar*0.95, "sine", 0.02, 0.3), t0)
    for k in range(8):  # pluck arpeggio, eighth notes
        put(buf, 0.10*tone(note(c[k % 3]+12), beat*0.5, "sine", 0.005, 0.25), t0+k*beat/2)
    for k in range(4):  # kick + hat
        kt = np.arange(int(0.18*SR))/SR; kick = np.sin(2*np.pi*(120*np.exp(-kt*22)+45)*kt)*np.exp(-kt*14)
        put(buf, 0.35*kick, t0+k*beat)
        hat = rng.standard_normal(int(0.04*SR))*np.exp(-np.arange(int(0.04*SR))/SR*90)
        put(buf, 0.05*hat, t0+k*beat+beat/2)
tw = sum(durs[:-2])  # start of twist scene
n = int(1.6*SR); t = np.arange(n)/SR  # riser into reveal
ris = rng.standard_normal(n)*(t/1.6)**2; ris = np.convolve(ris, np.ones(6)/6, "same")*0.12
put(buf, ris.astype(np.float32), tw-1.6)
for k, f in enumerate((79, 83, 86)): put(buf, 0.18*tone(note(f), 1.4, "sine", 0.005, 1.0), tw+0.05+k*0.08)  # chime
buf = buf[:int(total*SR)]; fo = int(2*SR); buf[-fo:] *= np.linspace(1, 0, fo)
buf *= 0.8/np.abs(buf).max(); sf.write(a.out, buf, SR); print(a.out, f"{total:.0f}s")
