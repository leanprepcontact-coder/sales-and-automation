"""Studio UPSC reel (1080x1920 MP4, ~32 s): NO voiceover, beat-synced synthesized BGM, kinetic typography,
camera punches on the beat, whip-pan cuts with RGB split, Nolan-style structure (cold open -> rewind -> lesson -> answer -> CTA).

Usage:
  python3 scripts/render_studio.py --spec content/story_examples/clemency_studio.json --out out/2026-11-20_Studio_Polity.mp4
  python3 scripts/render_studio.py --spec ... --out ... --stills 4.5,9,14,22,26,30   # quick preview PNGs only

Spec:
{"tag":"LEAD PRELIMS 2027","subject":"Polity","bpm":120,
 "scenes":[
  {"kind":"hook","stem":"short question text","options":["A","B","C","D"],"beats":12},
  {"kind":"rewind","title":"REWIND","sub":"Let's learn it properly","beats":4},
  {"kind":"point","chips":["A","B","C","D"],"focus":0,"label":"Pardon","anim":"erase|shorten|morph|pause|none",
        "icon":"emoji (when anim none)","tag":"WIPED CLEAN","meaning":"wipes out the *conviction* and sentence","mark":"check|cross","beats":6},
  {"kind":"rule","kicker":"Remember","lines":[["Remission","trims the *LENGTH*"],["Commutation","changes the *KIND*"]],"beats":8},
  {"kind":"answer","stem":"short question","options":["A","B","C","D"],"correct":3,"why":"Remission trims the *length*, not the kind.","beats":8},
  {"kind":"cta","big":"Daily Prelims quiz + *notes*","sub":"Free to start","url":"leanprep.in/lead-prelims","beats":8}]}
`*word*` = highlighted words. Needs Playwright (Chrome), ffmpeg, numpy, scipy, soundfile, Pillow.
"""
import argparse, base64, io, json, os, shutil, subprocess, tempfile
from pathlib import Path
import numpy as np, soundfile as sf
from scipy import signal

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "content" / "assets"
FPS, OUT_FPS, SR = 60, 30, 44100
DEFAULT_BEATS = {"hook": 12, "rewind": 4, "point": 6, "rule": 8, "answer": 8, "cta": 8}
# Am F C G, one chord per bar
BASS = [55.0, 43.65, 65.41, 49.0]
CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]]


def _hp(x, f):
    return signal.sosfilt(signal.butter(2, f / (SR / 2), "high", output="sos"), x)


def _lp(x, f):
    return signal.sosfilt(signal.butter(2, f / (SR / 2), "low", output="sos"), x)


def place(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or i < 0:
        return
    sig = sig[:len(buf) - i]
    buf[i:i + len(sig), 0] += sig * gain * np.sqrt((1 - pan) / 2)
    buf[i:i + len(sig), 1] += sig * gain * np.sqrt((1 + pan) / 2)


def tt(d):
    return np.arange(int(d * SR)) / SR


def kick():
    t = tt(.5); f = 42 + 120 * np.exp(-t * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    return (x + .5 * np.exp(-t * 400) * np.sin(2 * np.pi * 1800 * t)).astype(np.float32)


def clap(rng):
    t = tt(.3); n = _hp(rng.standard_normal(len(t)), 900)
    env = np.exp(-t * 22) + .6 * np.exp(-((t - .012) ** 2) / 2e-5) + .5 * np.exp(-((t - .024) ** 2) / 2e-5)
    return (_lp(n, 7000) * env * .8).astype(np.float32)


def hat(rng, open_=False):
    t = tt(.25 if open_ else .08); return (_hp(rng.standard_normal(len(t)), 7500) * np.exp(-t * (14 if open_ else 55)) * .5).astype(np.float32)


def tick():
    t = tt(.09); return (np.sin(2 * np.pi * 1500 * t) * np.exp(-t * 70) * .6 + np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 90) * .3).astype(np.float32)


def blip(f):
    t = tt(.16); fr = f * (1 + .5 * np.exp(-t * 30)); x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 28)
    return (x * .5 + .25 * np.sin(4 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 40)).astype(np.float32)


def boom(d=1.6):
    t = tt(d); x = np.sin(2 * np.pi * np.cumsum(60 * np.exp(-t * 1.2) + 28) / SR) * np.exp(-t * 2.6)
    return (x * 1.1).astype(np.float32)


def swell(d, rng, lo=300, hi=9000, rev=True):
    t = tt(d); n = rng.standard_normal(len(t)); k = np.linspace(0, 1, len(t))
    out = np.zeros_like(n)
    for a, b in ((lo, lo * 3), (lo * 3, lo * 9), (lo * 9, hi)):
        band = signal.sosfilt(signal.butter(2, [a / (SR / 2), min(b, hi) / (SR / 2)], "band", output="sos"), n)
        out += band * (k ** 2 if rev else (1 - k) ** 2)
    return (out * k ** 1.5 * .9 if rev else out * (1 - k) * .9).astype(np.float32)


def saw(f, d, detune=0.0):
    t = tt(d); return signal.sawtooth(2 * np.pi * f * (1 + detune) * t).astype(np.float32)


def music(total, scenes, events, bpm):
    B = 60 / bpm; n = int((total + 1) * SR); rng = np.random.default_rng(11)
    drums = np.zeros((n, 2), np.float32); harm = np.zeros((n, 2), np.float32); fx = np.zeros((n, 2), np.float32)
    drop = next(s["t0"] for s in scenes if s["kind"] == "point")
    ans = next((s for s in scenes if s["kind"] == "answer"), None)
    breakdown = (ans["t0"] + 1.0, ans["t0"] + 3 * B) if ans else (-1, -1)  # drums out before the stamp
    out_t = total - 1.0
    kicks = []
    nb = int(total / B) + 1
    for b in range(nb):
        t = b * B
        if t < drop - 1e-6 or t >= out_t or breakdown[0] <= t < breakdown[1]:
            continue
        place(drums, t, kick(), 1.0); kicks.append(t)
        place(drums, t + B / 2, hat(rng), .55, .25)
        if b % 2 == 1:
            place(drums, t, clap(rng), .75)
        if b % 4 == 3:
            place(drums, t + B / 2, hat(rng, True), .45, -.2)
        for q in (.25, .75):  # 16th ghost hats
            place(drums, t + q * B, hat(rng), .22, -.3 + .6 * (q > .5))
    # --- hook: low drone + accelerating ticks (no drums)
    hook = next(s for s in scenes if s["kind"] == "hook")
    d = tt(hook["t1"] - hook["t0"]); ramp = np.linspace(.15, 1, len(d)) ** 1.4
    drone = sum(np.sin(2 * np.pi * f * d + .6 * np.sin(2 * np.pi * .2 * d)) * a for f, a in ((55, .5), (82.4, .3), (110, .18), (164.8, .08)))
    place(harm, hook["t0"], (drone * ramp * .5).astype(np.float32), 1.0)
    tk = hook["t0"]
    while tk < hook["t1"] - .05:
        place(fx, tk, tick(), .5 + .4 * (tk - hook["t0"]) / (hook["t1"] - hook["t0"]), -.2 if int((tk - hook["t0"]) / B) % 2 else .2)
        u = (tk - hook["t0"]) / (hook["t1"] - hook["t0"]); tk += B if u < .5 else B / 2 if u < .85 else B / 4
    # --- rewind riser, tape-stop feel, silence before the drop
    rw = next(s for s in scenes if s["kind"] == "rewind"); D = rw["t1"] - rw["t0"]
    place(fx, rw["t0"], swell(D - .12, rng), .8)
    t = tt(D - .12); f = 200 * np.exp(np.log(10) * t / (D - .12)); place(fx, rw["t0"], (np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / t[-1]) ** 2 * .35).astype(np.float32), 1.0)
    place(fx, rw["t0"], boom(), .9)
    # --- cuts: reverse swell ending on the cut + impact
    for s in scenes[1:]:
        if s["kind"] == "rewind":
            continue
        place(fx, s["t0"] - .3, swell(.3, rng, 600, 8000), .55)
        place(fx, s["t0"], boom(1.0), 1.0 if s["t0"] == drop else .55)
    # --- bass + pad + arp, ducked by the kick
    bar = 4 * B
    for b in range(int(total / bar) + 1):
        t0 = b * bar
        if t0 >= total:
            break
        ch = b % 4
        pad = sum(saw(f, bar + .5, dt) for f in CHORDS[ch] for dt in (-.004, .004))
        pad = _lp(pad, 900 + 700 * (t0 >= drop)) * np.minimum(1, tt(bar + .5) / .5) * np.minimum(1, (bar + .5 - tt(bar + .5)) / .3)
        place(harm, t0, (pad * (.11 if t0 < drop else .16)).astype(np.float32), 1.0)
        if t0 + bar > drop:
            for q in range(8):  # offbeat-pumped bass
                tn = t0 + q * B / 2
                if tn < drop - 1e-6 or tn >= out_t or breakdown[0] <= tn < breakdown[1]:
                    continue
                x = tt(B / 2); env = np.exp(-x * 5) * np.minimum(1, x / .006)
                bn = np.sin(2 * np.pi * BASS[ch] * x) + .35 * np.sin(4 * np.pi * BASS[ch] * x)
                place(harm, tn, (np.tanh(bn * 1.6) * env * .55).astype(np.float32), 1.0)
            pat = [0, 1, 2, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 0]
            for q in range(16):
                tn = t0 + q * B / 4
                if tn < drop - 1e-6 or tn >= out_t or breakdown[0] <= tn < breakdown[1]:
                    continue
                f = CHORDS[ch][pat[q] % 3] * 2; x = tt(.3)
                pl = (np.sin(2 * np.pi * f * x) * .6 + signal.sawtooth(2 * np.pi * f * x) * .25) * np.exp(-x * 11)
                place(harm, tn, (pl * .2).astype(np.float32), 1.0, -.4 + .8 * ((q % 2) == 0))
                place(harm, tn + 3 * B / 4, (pl * .07).astype(np.float32), 1.0, .5 - q % 2)  # echo
    # --- stamp / hits / pops from the visual timeline
    pent = [440, 523.25, 587.33, 659.25, 783.99]; pi = 0
    for e in events:
        if e["type"] == "pop":
            place(fx, e["t"], blip(pent[pi % 5]), .35 if e["t"] >= drop else .22, ((pi % 3) - 1) * .4); pi += 1
        elif e["type"] == "tick":
            place(fx, e["t"], tick(), .3, -.3)
        elif e["type"] == "hit" and e["t"] > drop:
            place(fx, e["t"], blip(1046.5), .3, .3)
        elif e["type"] == "stamp":
            place(fx, e["t"], boom(1.8), 1.6); place(fx, e["t"], (_hp(rng.standard_normal(int(.9 * SR)), 3000) * np.exp(-tt(.9) * 5) * .9).astype(np.float32), .9)
            place(drums, e["t"], kick(), 1.0); place(drums, e["t"], clap(rng), .9)
    # --- sidechain: duck harmony on every kick
    duck = np.ones(n, np.float32)
    for kt in kicks:
        i = int(kt * SR); L = int(.28 * SR); seg = duck[i:i + L]
        duck[i:i + len(seg)] = np.minimum(seg, (1 - .7 * np.exp(-np.arange(len(seg)) / (.09 * SR))).astype(np.float32))
    harm *= duck[:, None]
    mix = drums * .95 + harm * 1.0 + fx * .85
    g = np.ones(n, np.float32)  # silence gap right before the drop
    g[int((drop - .1) * SR):int(drop * SR)] = np.linspace(0, 1, int(.1 * SR)) ** 4
    g[int((drop - .13) * SR):int((drop - .1) * SR)] = 0
    mix *= g[:, None]
    end = int(total * SR); fade = np.ones(n, np.float32); L = int(1.4 * SR); fade[end - L:end] = np.linspace(1, 0, L) ** 1.5; fade[end:] = 0
    mix *= fade[:, None]
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    mix *= .9 / (np.abs(mix).max() or 1)
    return mix[:int(total * SR) + 1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--stills", help="comma-separated seconds; writes PNGs next to --out and skips video")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    bpm = float(spec.get("bpm", 120)); B = 60 / bpm
    t = 0.0
    for sc in spec["scenes"]:
        sc["t0"] = t; t += float(sc.get("beats", DEFAULT_BEATS[sc["kind"]])) * B; sc["t1"] = t
    total = t
    drop = next(s["t0"] for s in spec["scenes"] if s["kind"] == "point")
    hook = next(s for s in spec["scenes"] if s["kind"] == "hook")
    tmp = Path(tempfile.mkdtemp())
    for f in ASSETS.iterdir():
        shutil.copy(f, tmp / f.name)
    cfg = {"tag": spec.get("tag", "LEAD PRELIMS 2027"), "subject": spec.get("subject", ""), "bpm": bpm, "scenes": spec["scenes"], "total": total,
           "drop": drop, "rewindFrom": hook["t1"] - hook["t0"], "fps": FPS}
    noise = (np.random.default_rng(3).random((256, 256)) * 255).astype(np.uint8)
    from PIL import Image
    b = io.BytesIO(); Image.fromarray(noise, "L").save(b, "PNG")
    css = """
@font-face{font-family:'Sans';font-weight:500;src:url('instrument-sans-latin-500-normal.woff2')}
@font-face{font-family:'Sans';font-weight:600;src:url('instrument-sans-latin-600-normal.woff2')}
@font-face{font-family:'Sans';font-weight:700;src:url('instrument-sans-latin-700-normal.woff2')}
body{margin:0;width:1080px;height:1920px;background:#05080F;overflow:hidden;position:relative}
#grain{position:absolute;inset:0;background-image:url(data:image/png;base64,%s);mix-blend-mode:overlay;opacity:.5;pointer-events:none}
""" % base64.b64encode(b.getvalue()).decode()
    html = (f"<html><head><style>{css}</style></head><body><div id='stage'></div><div id='grain'></div>"
            f"<script>const CFG={json.dumps(cfg)};{(HERE / 'studio_scene.js').read_text()}</script></body></html>")
    (tmp / "s.html").write_text(html)
    N = int(total * FPS)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch(channel="chrome")
        pg = br.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto((tmp / "s.html").as_uri())
        pg.evaluate("Promise.all([500,600,700].map(w=>document.fonts.load(w+' 40px Sans')))"); pg.wait_for_timeout(400)
        events = pg.evaluate(f"(()=>{{for(let i=0;i<{N};i+=2)frame(i/{FPS},true);return events()}})()")
        if a.stills:
            os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
            for s in a.stills.split(","):
                pg.evaluate(f"frame({float(s)})"); pg.screenshot(path=str(Path(a.out).with_suffix("")) + f"_still_{float(s):05.1f}.png")
            br.close(); print("stills done", f"{total:.1f}s"); return
        mix = music(total, spec["scenes"], events, bpm)
        sf.write(str(tmp / "mix.wav"), mix, SR)
        fr = tmp / "fr"; fr.mkdir()
        for i in range(N):
            pg.evaluate(f"frame({i / FPS:.4f})")
            pg.screenshot(path=str(fr / f"{i:05d}.jpg"), type="jpeg", quality=90)
        br.close()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(fr / "%05d.jpg"), "-i", str(tmp / "mix.wav"),
                    "-vf", f"tmix=frames=2,fps={OUT_FPS},format=yuv420p", "-r", str(OUT_FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", a.out], check=True)
    shutil.copy(fr / f"{int((hook['t0'] + 4.6) * FPS):05d}.jpg", Path(a.out).with_suffix(".cover.jpg"))
    print(a.out, f"{total:.1f}s", f"{len(events)} sfx events")


if __name__ == "__main__":
    main()
