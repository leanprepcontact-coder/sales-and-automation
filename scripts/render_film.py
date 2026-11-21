"""Cinematic 2D short film (1080x1920 MP4): scenes from scripts/film_scene.js, sound from scripts/film_sound.py. No voiceover.

Usage:
  python3 scripts/render_film.py --spec content/story_examples/clemency_film.json --out out/2026-11-22_Film_Article72.mp4
  python3 scripts/render_film.py --spec ... --out ... --stills 2,7,11,15      # preview PNGs only
Needs Playwright (Chrome), ffmpeg, numpy, scipy, soundfile, Pillow.
"""
import argparse, json, os, shutil, subprocess, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "content" / "assets"
FPS, OUT_FPS = 60, 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--stills")
    ap.add_argument("--silent", action="store_true")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    t = 0.0
    for sh in spec["shots"]:
        sh["t0"] = t; t += sh["dur"]; sh["t1"] = t
    total = t
    tmp = Path(tempfile.mkdtemp())
    for f in ASSETS.iterdir():
        shutil.copy(f, tmp / f.name)
    css = """
@font-face{font-family:'Sans';font-weight:400;src:url('instrument-sans-latin-400-normal.woff2')}
@font-face{font-family:'Sans';font-weight:500;src:url('instrument-sans-latin-500-normal.woff2')}
@font-face{font-family:'Sans';font-weight:600;src:url('instrument-sans-latin-600-normal.woff2')}
@font-face{font-family:'Sans';font-weight:700;src:url('instrument-sans-latin-700-normal.woff2')}
@font-face{font-family:'Serif';font-weight:400;font-style:normal;src:url('instrument-serif-latin-400-normal.woff2')}
@font-face{font-family:'Serif';font-weight:400;font-style:italic;src:url('instrument-serif-latin-400-italic.woff2')}
body{margin:0;width:1080px;height:1920px;background:#02040a;overflow:hidden}
"""
    cfg = {"shots": spec["shots"], "total": total}
    html = (f"<html><head><style>{css}</style></head><body><div id='stage'></div>"
            f"<script>const CFG={json.dumps(cfg)};{(HERE / 'film_scene.js').read_text()}</script></body></html>")
    (tmp / "s.html").write_text(html)
    N = int(total * FPS)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch(channel="chrome")
        pg = br.new_page(viewport={"width": 1080, "height": 1920})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto((tmp / "s.html").as_uri())
        pg.evaluate("Promise.all([400,500,600,700].map(w=>document.fonts.load(w+' 40px Sans')).concat([document.fonts.load('40px Serif'),document.fonts.load('italic 40px Serif')]))")
        pg.wait_for_timeout(500)
        if a.stills:
            os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
            for s in a.stills.split(","):
                pg.evaluate(f"frame({float(s)})")
                pg.screenshot(path=str(Path(a.out).with_suffix("")) + f"_still_{float(s):05.1f}.png")
            br.close(); print("stills done", f"{total:.1f}s", errs[:3]); return
        mix = tmp / "mix.wav"
        if not a.silent:
            import film_sound
            film_sound.build(spec, total, str(mix))
        fr = tmp / "fr"; fr.mkdir()
        for i in range(N):
            pg.evaluate(f"frame({i / FPS:.4f})")
            pg.screenshot(path=str(fr / f"{i:05d}.jpg"), type="jpeg", quality=92)
        br.close()
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    vf = ("tmix=frames=2,fps=%d,eq=contrast=1.07:saturation=1.08:gamma=0.98,"
          "colorbalance=rs=-.02:bs=.04:rh=.03:bh=-.02,noise=alls=9:allf=t,format=yuv420p" % OUT_FPS)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(fr / "%05d.jpg")]
    if not a.silent:
        cmd += ["-i", str(mix)]
    cmd += ["-vf", vf, "-r", str(OUT_FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]
    if not a.silent:
        cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    cov = next(s for s in spec["shots"] if s["id"] == spec.get("cover_shot", "desk"))
    shutil.copy(fr / f"{int((cov['t0'] + spec.get('cover_at', 3.2)) * FPS):05d}.jpg", Path(a.out).with_suffix(".cover.jpg"))
    print(a.out, f"{total:.1f}s", errs[:3])


if __name__ == "__main__":
    main()
