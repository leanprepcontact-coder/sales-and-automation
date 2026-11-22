"""Hand-drawn sketch reel (1080x1920 MP4) from scripts/sketch_scene.js (rough.js inlined).

Usage:
  python3 scripts/render_sketch.py --out out/sketch.mp4 --total 36.5
  python3 scripts/render_sketch.py --out out/sketch.mp4 --stills 4.5,19,35     # preview PNGs only
"""
import argparse, os, shutil, subprocess, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "content" / "assets"
FPS, OUT_FPS = 30, 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--total", type=float, default=36.5)
    ap.add_argument("--stills")
    ap.add_argument("--audio")
    a = ap.parse_args()
    tmp = Path(tempfile.mkdtemp())
    for f in ASSETS.iterdir():
        shutil.copy(f, tmp / f.name)
    css = """
@font-face{font-family:'Hand';font-weight:700;src:url('caveat-latin-700-normal.woff2')}
@font-face{font-family:'Hand';font-weight:500;src:url('caveat-latin-500-normal.woff2')}
@font-face{font-family:'Hand2';font-weight:400;src:url('patrick-hand-latin-400-normal.woff2')}
body{margin:0;width:1080px;height:1920px;background:#f3eee2;overflow:hidden}
"""
    html = (f"<html><head><style>{css}</style></head><body><div id='stage'></div>"
            f"<script>{(HERE / 'vendor' / 'rough.js').read_text()}</script>"
            f"<script>{(HERE / 'sketch_scene.js').read_text()}</script></body></html>")
    (tmp / "s.html").write_text(html)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch(channel="chrome")
        pg = br.new_page(viewport={"width": 1080, "height": 1920})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto((tmp / "s.html").as_uri())
        pg.evaluate("Promise.all([document.fonts.load('700 40px Hand'),document.fonts.load('500 40px Hand'),document.fonts.load('400 40px Hand2')])")
        pg.wait_for_timeout(500)
        if a.stills:
            os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
            for s in a.stills.split(","):
                pg.evaluate(f"frame({float(s)})")
                pg.screenshot(path=str(Path(a.out).with_suffix("")) + f"_still_{float(s):05.1f}.png")
            br.close(); print("stills done", errs[:3]); return
        sc = pg.evaluate("items.filter(i=>!i.isText).map(i=>[i.t0,Math.min(i.dur,1.8)])")
        import sys; sys.path.insert(0, str(HERE))
        import sketch_sound
        mix = tmp / "mix.wav"; sketch_sound.build(a.total, str(mix), sc)
        if not a.audio: a.audio = str(mix)
        fr = tmp / "fr"; fr.mkdir()
        N = int(a.total * FPS)
        for i in range(N):
            pg.evaluate(f"frame({i / FPS:.4f})")
            pg.screenshot(path=str(fr / f"{i:05d}.jpg"), type="jpeg", quality=92)
        br.close()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(fr / "%05d.jpg")]
    if a.audio:
        cmd += ["-i", a.audio]
    cmd += ["-r", str(OUT_FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
    if a.audio:
        cmd += ["-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    print("done", a.out)


if __name__ == "__main__":
    main()
