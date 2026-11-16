"""Text-on-screen reel (1080x1920 MP4) from a JSON spec, in LeanPrep brand style.

Usage:
  python3 scripts/render_reel.py --spec reel.json --out out/2026-11-16_Reel.mp4

Spec:
{
  "tag": "Prelims 2027 · Polity",
  "slides": [
    {"kind": "hook", "text": "Still mixing up these 3 President facts?", "secs": 3},
    {"kind": "point", "num": "1", "title": "Vote value",
     "rows": [["MLA's vote", "varies with the state's population"], ["MP's vote", "same for every MP"]], "secs": 5},
    {"kind": "checks", "num": "3", "title": "Vetoes",
     "items": [["Absolute", true], ["Qualified", false]], "secs": 6},
    {"kind": "cta", "big": "Comment TEST", "sub": "We'll DM you the free Polity test", "secs": 5}
  ]
}
Needs Playwright (Chrome) and ffmpeg. Output: H.264 + silent AAC, 30 fps, 0.35 s crossfades.
"""
import argparse, html, json, os, shutil, subprocess, tempfile
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "content" / "assets"
LINK = "leanprep.in/lead-prelims"
FADE = 0.35

CSS = """
@font-face{font-family:'Serif';src:url('instrument-serif-latin-400-normal.woff2')}
@font-face{font-family:'Serif';font-style:italic;src:url('instrument-serif-latin-400-italic.woff2')}
@font-face{font-family:'Sans';font-weight:500;src:url('instrument-sans-latin-500-normal.woff2')}
@font-face{font-family:'Sans';font-weight:600;src:url('instrument-sans-latin-600-normal.woff2')}
@font-face{font-family:'Sans';font-weight:700;src:url('instrument-sans-latin-700-normal.woff2')}
:root{--ink:#0A1628;--or:#FF6B00;--paper:#FFF8F0;--line:#E6DCCB;--ok:#0F6B3A;--bad:#B42318;--mute:#4A5565}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;background:var(--paper);font-family:'Sans';color:var(--ink);overflow:hidden;
 display:flex;flex-direction:column;padding:150px 84px 0}
.top{display:flex;justify-content:space-between;align-items:center}
.top img{height:64px}
.tag{color:var(--or);font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:28px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:48px}
.hook{font-family:'Sans';font-weight:700;font-size:112px;line-height:1.05;text-transform:uppercase}
.hook em{font-family:'Serif';font-style:italic;font-weight:400;color:var(--or);text-transform:none}
.num{width:120px;height:120px;border-radius:50%;background:var(--or);color:#fff;display:grid;place-items:center;
 font-size:68px;font-weight:700}
.title{font-family:'Serif';font-size:110px;line-height:1}
.row{background:#fff;border:3px solid var(--line);border-radius:28px;padding:34px 40px}
.row b{display:block;color:var(--or);font-size:44px;font-weight:700;margin-bottom:8px}
.row span{font-size:52px;font-weight:600;line-height:1.2}
.big{font-size:58px;font-weight:600;line-height:1.25}
.chk{display:flex;justify-content:space-between;align-items:center;background:#fff;border:3px solid var(--line);
 border-radius:28px;padding:30px 40px;font-size:60px;font-weight:700}
.chk i{font-style:normal;font-size:40px;font-weight:700;color:#fff;padding:10px 26px;border-radius:999px}
.chk.y i{background:var(--ok)} .chk.n{border-color:var(--bad)} .chk.n i{background:var(--bad)}
.cta{font-size:150px;font-weight:700;line-height:1;color:var(--or)}
.sub{font-size:60px;font-weight:600;line-height:1.2}
.bar{margin:0 -84px;background:var(--or);color:#fff;padding:36px 84px;font-size:40px;font-weight:600;white-space:nowrap}
.foot{margin:0 -84px;background:var(--ink);color:#fff;padding:44px 84px 260px;font-size:38px;font-weight:500}
"""


def e(s):
    return html.escape(str(s))


def slide_html(tag, s):
    k = s["kind"]
    if k == "hook":
        words = e(s["text"])
        mid = f'<div class="hook">{words}</div>'
    elif k == "point":
        rows = "".join(f'<div class="row"><b>{e(a)}</b><span>{e(b)}</span></div>' for a, b in s.get("rows", []))
        body = f'<div class="big">{e(s["body"])}</div>' if s.get("body") else ""
        mid = f'<div class="num">{e(s["num"])}</div><div class="title">{e(s["title"])}</div>{rows}{body}'
    elif k == "checks":
        items = "".join(
            f'<div class="chk {"y" if ok else "n"}"><span>{e(name)}</span><i>{"YES" if ok else "NO"}</i></div>'
            for name, ok in s["items"])
        mid = f'<div class="num">{e(s["num"])}</div><div class="title">{e(s["title"])}</div>{items}'
    elif k == "cta":
        mid = f'<div class="cta">{e(s["big"])}</div><div class="sub">{e(s["sub"])}</div>'
    else:
        raise SystemExit(f"unknown slide kind {k}")
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
            f'<div class="top"><img src="logo.png"><div class="tag">{e(tag)}</div></div>'
            f'<div class="mid">{mid}</div>'
            f'<div class="bar">Free tests + notes &rarr; {LINK}</div>'
            f'<div class="foot">Daily quiz on Telegram: t.me/leanprep</div></body></html>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    from playwright.sync_api import sync_playwright

    tmp = Path(tempfile.mkdtemp())
    for f in ASSETS.iterdir():
        shutil.copy(f, tmp / f.name)
    pngs = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        for i, s in enumerate(spec["slides"]):
            h = tmp / f"s{i}.html"
            h.write_text(slide_html(spec.get("tag", "LEAD Prelims 2027"), s))
            pg.goto(h.as_uri())
            pg.wait_for_timeout(300)
            out = tmp / f"s{i}.png"
            pg.screenshot(path=str(out))
            pngs.append((out, float(s.get("secs", 4))))
        b.close()

    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for png, secs in pngs:
        cmd += ["-loop", "1", "-t", f"{secs + FADE:.2f}", "-framerate", "30", "-i", str(png)]
    total = sum(s for _, s in pngs) + FADE
    cmd += ["-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=r=44100:cl=stereo"]
    parts, last, offset = [], "0:v", 0.0
    for i in range(1, len(pngs)):
        offset += pngs[i - 1][1]
        lab = f"v{i}"
        parts.append(f"[{last}][{i}:v]xfade=transition=fade:duration={FADE}:offset={offset:.2f}[{lab}]")
        last = lab
    parts.append(f"[{last}]format=yuv420p[vout]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[vout]", "-map", f"{len(pngs)}:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30",
            "-c:a", "aac", "-shortest", "-movflags", "+faststart", a.out]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    subprocess.run(cmd, check=True)
    shutil.copy(tmp / "s0.png", Path(a.out).with_suffix(".cover.png"))
    print(a.out)


if __name__ == "__main__":
    main()
