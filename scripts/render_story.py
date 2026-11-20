"""Cinematic cartoon story reel (1080x1920 MP4, ~30-35 s) with toddler AI voice and a Nolan-style structure:
cold open at the end (black and white) -> title card with a reversing clock -> story in colour -> return to the open.

Usage:
  python3 scripts/render_story.py --spec story.json --out out/2026-11-20_Story.mp4

Spec (see content/story_examples/remission.json):
{
 "tag": "Prelims 2027 · Polity", "voice": "af_nova", "pitch": 1.45,
 "scenes": [
  {"kind":"open",  "chapter":"", "voice":"...", "cap":["line","line"], "words":["A","B","C","D"], "min":5},
  {"kind":"title", "title":"Two days earlier", "voice":"Two days earlier.", "cap":[...], "min":3},
  {"kind":"concept","anim":"trim|swap|erase|pause", "label":"Remission", "from":"scarf", "to":"hat",
                    "tag":"NOW A HAT", "voice":"...", "cap":[...], "min":5},
  {"kind":"return", "words":["A","B","C","D"], "voice":"...", "cap":[...], "min":5},
  {"kind":"cta", "big":"Comment TEST", "voice":"...", "cap":[...], "min":5}
 ]}
Props: "scarf" and "hat" are drawn; any other string is shown as an emoji (e.g. "📝", "🧽").
Needs Playwright (Chrome), ffmpeg, numpy, soundfile, kokoro-onnx (scripts/voice.py).
"""
import argparse, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path
import numpy as np, soundfile as sf

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "content" / "assets"
FPS = 24
SR = 24000


def child_voice(x, sr, ratio):
    """Raise pitch (and formants) like a small child, keep the speed."""
    d = Path(tempfile.mkdtemp())
    sf.write(str(d / "a.wav"), x, sr)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(d / "a.wav"), "-af",
                    f"asetrate={int(sr * ratio)},aresample={sr},atempo={1 / ratio:.4f}", str(d / "b.wav")], check=True)
    y, _ = sf.read(str(d / "b.wav"), dtype="float32")
    return y


def music(total, scenes):
    n = int((total + 1) * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    m = np.zeros(n, dtype=np.float32)
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * t / 9.0 - 1.2)
    for f, a in ((55, .5), (82.4, .35), (110, .25), (164.8, .12)):
        m += (a * swell * np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * .13 * t))).astype(np.float32)
    for sc in scenes:
        i0, i1 = int(sc["t0"] * SR), int(sc["t1"] * SR)
        if sc["kind"] == "open":  # ticking clock, accelerating
            tt, k = 0.0, 0
            while tt < sc["t1"] - .1:
                i = int(tt * SR); L = int(.05 * SR)
                env = np.exp(-np.arange(L) / (.008 * SR))
                m[i:i + L] += (.5 * env * np.sin(2 * np.pi * (1800 if k % 2 else 1300) * np.arange(L) / SR)).astype(np.float32)[:max(0, n - i)][:L]
                u = (tt - sc["t0"]) / (sc["t1"] - sc["t0"])
                tt += 0.5 - 0.27 * u; k += 1
        if sc["kind"] == "title":  # boom + rising riser (reverse clock)
            L = int(1.6 * SR); i = i0
            env = np.exp(-np.arange(L) / (.5 * SR))
            m[i:i + L] += (1.2 * env * np.sin(2 * np.pi * 38 * np.arange(L) / SR) + .4 * env * rng.standard_normal(L)).astype(np.float32)
            T = np.arange(i1 - i0) / SR; D = max(.1, T[-1])
            ph = 2 * np.pi * (180 * D / np.log(8) * (np.exp(np.log(8) * T / D) - 1))
            m[i0:i1] += (.35 * (T / D) * np.sin(ph) * (1 + .5 * np.sin(2 * np.pi * 14 * T))).astype(np.float32)
        if sc["kind"] in ("concept", "return", "cta"):  # soft whoosh at scene start
            L = int(.5 * SR); i = i0
            w = rng.standard_normal(L) * np.hanning(L) * .22
            m[i:i + L] += w.astype(np.float32)
        if sc["kind"] in ("return", "cta"):  # warm resolve chord
            ch = np.zeros(i1 - i0, dtype=np.float32); T = np.arange(i1 - i0) / SR
            for f in (220, 277.2, 329.6, 440):
                ch += (.12 * np.sin(2 * np.pi * f * T)).astype(np.float32)
            m[i0:i1] += ch * np.minimum(1, T / 1.5).astype(np.float32)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--frames-only", action="store_true")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    sys.path.insert(0, str(HERE))
    from voice import synth
    import voice as V
    V.VOICE = spec.get("voice", "af_nova")
    ratio = float(spec.get("pitch", 1.45))

    # 1. voices and timeline
    t, clips = 0.0, []
    for sc in spec["scenes"]:
        x, sr = synth(sc["voice"])
        assert sr == SR
        x = child_voice(x, sr, ratio)
        dur = len(x) / SR
        sc["t0"] = t
        sc["t1"] = t + max(float(sc.get("min", 4)), dur + .9)
        clips.append((sc["t0"] + .3, x))
        t = sc["t1"]
    total = t
    N = int(total * FPS)

    # 2. mouth envelope
    voice = np.zeros(int((total + 1) * SR), dtype=np.float32)
    for st, x in clips:
        i = int(st * SR); voice[i:i + len(x)] += x
    env = np.zeros(N)
    for f in range(N):
        seg = voice[int(f / FPS * SR):int((f + 1) / FPS * SR)]
        env[f] = float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0
    env = np.clip(env / (env.max() or 1) * 1.6, 0, 1).round(2).tolist()

    # 3. audio mix (music ducked under voice)
    mus = music(total, spec["scenes"])[:len(voice)]
    duck = np.convolve(np.abs(voice), np.ones(int(.15 * SR)) / int(.15 * SR), mode="same")
    duck = 1 - .6 * np.clip(duck / (duck.max() or 1) * 3, 0, 1)
    mix = mus * .55 * duck + voice * 1.0
    mix *= 0.92 / (np.abs(mix).max() or 1)
    tmp = Path(tempfile.mkdtemp())
    sf.write(str(tmp / "mix.wav"), mix, SR)

    # 4. frames
    for f in ASSETS.iterdir():
        shutil.copy(f, tmp / f.name)
    cfg = {"tag": spec.get("tag", "LEAD Prelims 2027"), "scenes": spec["scenes"], "env": env, "fps": FPS, "total": total}
    noise = (np.random.default_rng(3).random((256, 256)) * 255).astype(np.uint8)
    import base64, io
    from PIL import Image
    b = io.BytesIO(); Image.fromarray(noise, "L").save(b, "PNG")
    css = """
@font-face{font-family:'Sans';font-weight:500;src:url('instrument-sans-latin-500-normal.woff2')}
@font-face{font-family:'Sans';font-weight:600;src:url('instrument-sans-latin-600-normal.woff2')}
@font-face{font-family:'Sans';font-weight:700;src:url('instrument-sans-latin-700-normal.woff2')}
body{margin:0;width:1080px;height:1920px;background:#05080F;overflow:hidden;position:relative}
#grain{position:absolute;inset:0;background-image:url(data:image/png;base64,%s);mix-blend-mode:overlay;pointer-events:none}
""" % base64.b64encode(b.getvalue()).decode()
    html = f"<html><head><style>{css}</style></head><body><div id='stage'></div><div id='grain'></div><script>const CFG={json.dumps(cfg)};{(HERE / 'story_scene.js').read_text()}</script></body></html>"
    (tmp / "s.html").write_text(html)
    fr = tmp / "fr"; fr.mkdir()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch(channel="chrome")
        pg = br.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto((tmp / "s.html").as_uri()); pg.wait_for_timeout(500)
        for i in range(N):
            pg.evaluate(f"frame({i / FPS:.4f})")
            pg.screenshot(path=str(fr / f"{i:05d}.jpg"), type="jpeg", quality=90)
        br.close()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(fr / "%05d.jpg"), "-i", str(tmp / "mix.wav"),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                    "-shortest", "-movflags", "+faststart", a.out], check=True)
    shutil.copy(fr / f"{int(N * .45):05d}.jpg", Path(a.out).with_suffix(".cover.jpg"))
    print(a.out, f"{total:.1f}s")


if __name__ == "__main__":
    main()
