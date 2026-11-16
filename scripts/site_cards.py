#!/usr/bin/env python3
"""Daily "free on LEAD-Prelims" cards (1080x1350), built from the live course page.

Usage:
  # 1. Free-test slide: screenshot of the subject's free notes + free Concept Test + free Sectional
  python3 scripts/site_cards.py promo --subject Environment --date 2026-11-17 \
      --lead "Today's Q1 is Question 18 of the free Concept Test and Q2 is Question 7 of the free Sectional." --out out/

  # 2. Notes snippet: list free notes, download pages to look at, then crop one block
  python3 scripts/site_cards.py notes-list
  python3 scripts/site_cards.py notes-pages --id notes-env --out pages/        # PNG per page, to read
  python3 scripts/site_cards.py notes-card --id notes-env --page 4 --top 0.17 --bottom 0.43 \
      --date 2026-11-17 --out out/

--top/--bottom are fractions of the page height (0 = top edge, 1 = bottom edge); --left/--right of the width.
Pick one self-contained block (a heading with its bullets, a starred fact, a Trap/Fact line, a table) so the text stays readable.
Only free items are shown: the paid "buy to open" boxes are hidden in the screenshot.
Needs: playwright (python), Pillow, curl.
"""
import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date as Date
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_post import ASSETS, COURSE_LINK, CSS  # noqa: E402

SITE = "https://bejewelled-biscuit-6f2caa.netlify.app"

EXTRA = """
.lead{font-size:var(--fs);line-height:1.4;margin-top:24px}
.lead b{color:var(--or);font-weight:600}
.shot{margin-top:28px;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(10,22,40,.18);border:2px solid var(--line);background:#fff}
.shot img{display:block;width:100%}
.src{margin-top:14px;font-size:22px;color:var(--mute)}
.steps{margin-top:auto;padding-top:22px;margin-bottom:34px;display:flex;gap:16px}
.steps div{flex:1;background:#fff;border:2px solid var(--line);border-radius:16px;padding:16px 18px;font-size:24px;font-weight:600;line-height:1.3}
.steps span{color:var(--or)}
.link{font-size:34px;text-align:center;padding:20px 72px}
"""


def launch(p):
    try:
        return p.chromium.launch(channel="chrome")
    except Exception:
        return p.chromium.launch()


def card_html(kicker: list[str], title: str, lead: str, img: str, src: str, steps: list[str]) -> str:
    pills = "".join(f'<span class="pill{" or" if i == 0 else ""}">{html.escape(k)}</span>' for i, k in enumerate(kicker))
    st = "".join(f"<div><span>{i}</span> {html.escape(s)}</div>" for i, s in enumerate(steps, 1))
    src_html = f'<div class="src">{html.escape(src)}</div>' if src else ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{EXTRA}</style></head><body><div class="page">
<div class="top"><img src="logo.png"><div class="tag">LEAD-Prelims 2027</div></div>
<div class="kicker">{pills}</div>
<h1>{title}</h1>
<div class="lead">{lead}</div>
<div class="shot"><img src="{img}"></div>{src_html}
<div class="steps">{st}</div>
<div class="link">{COURSE_LINK}</div>
<div class="foot"><div class="l">Free tests + notes · <span>link in bio</span></div><div class="r">LEAD-Prelims 2027<br>by LeanPrep</div></div>
</div></body></html>"""


def compose(html_doc: str, img_path: Path, out_path: str) -> str:
    """Renders a card; shrinks the lead text until everything fits on 1080x1350."""
    tmp_img = ASSETS / ("_" + img_path.name)
    shutil.copy(img_path, tmp_img)
    tmp = ASSETS / "_card.html"
    tmp.write_text(html_doc.replace('src="IMG"', f'src="{tmp_img.name}"'), encoding="utf-8")
    try:
        with sync_playwright() as p:
            b = launch(p)
            pg = b.new_page(viewport={"width": 1080, "height": 1350})
            pg.goto(tmp.as_uri())
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(200)
            fit = pg.evaluate("""() => {
              const page = document.querySelector('.page'); let fs = 32;
              const set = v => document.documentElement.style.setProperty('--fs', v + 'px');
              set(fs);
              while (page.scrollHeight > page.clientHeight && fs > 22) { fs -= 1; set(fs); }
              return {fs, overflow: page.scrollHeight > page.clientHeight};
            }""")
            if fit["overflow"]:
                raise SystemExit("Card content does not fit: shorten --lead or crop a smaller notes block")
            pg.screenshot(path=out_path)
            b.close()
    finally:
        tmp.unlink(missing_ok=True)
        tmp_img.unlink(missing_ok=True)
    return out_path


# ---------- free-test slide ----------

def shoot_subject(subject: str, out_png: Path) -> None:
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page(viewport={"width": 900, "height": 1200}, device_scale_factor=2)
        pg.goto(SITE + "/", wait_until="networkidle")
        pg.click("#tabs >> text=Subject tests")
        pg.wait_for_timeout(800)
        pg.add_style_tag(content=".locked{display:none!important}")
        pg.wait_for_timeout(300)
        blocks = pg.locator(".subj")
        target = None
        for i in range(blocks.count()):
            head = blocks.nth(i).inner_text().split("\n", 1)[0].strip()
            if head.lower() == subject.lower():
                target = blocks.nth(i)
                break
        if target is None:
            raise SystemExit(f"Subject '{subject}' not found on the Subject tests tab")
        target.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        target.screenshot(path=str(out_png))
        b.close()


def cmd_promo(a) -> None:
    os.makedirs(a.out, exist_ok=True)
    d = Path(tempfile.mkdtemp())
    shot = d / f"site_{a.subject.replace(' ', '_').replace('&', 'and')}.png"
    shoot_subject(a.subject, shot)
    nice = Date.fromisoformat(a.date).strftime("%-d %b")
    doc = card_html(
        [f"{a.slot} · {nice}", a.subject, "Free"],
        a.title,
        a.lead,
        "IMG",
        "",
        ["Open the link in bio", f"Subject tests › {a.subject}", "Start test or Open notes (free, no password)"],
    )
    print(compose(doc, shot, os.path.join(a.out, f"{a.date}_free-tests_{slug(a.subject)}.png")))


# ---------- notes snippet ----------

def notes_index() -> list[dict]:
    with urllib.request.urlopen(SITE + "/data/notes.json", timeout=60) as r:
        return json.load(r)


def page_png(nid: str, page: int, out: Path) -> Path:
    from PIL import Image

    url = f"{SITE}/notes_img/{nid}/{page:03d}.webp"
    with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as f:
        subprocess.run(["curl", "-sSfL", "-m", "60", "-o", f.name, url], check=True)
        Image.open(f.name).convert("RGB").save(out)
    os.unlink(f.name)
    return out


def module_for(n: dict, page: int) -> str:
    cur = ""
    for m in n.get("modules", []):
        if m["p"] <= page:
            cur = m["t"]
    return cur


def cmd_notes_list(a) -> None:
    for n in notes_index():
        print(f"{n['id']:14} {n['subject']:18} {n['pages']:>3} pages  {'complete' if n.get('full') else 'sample'}  {n['title']}")
        for m in n.get("modules", []):
            print(f"{'':16}p{m['p']:<4} {m['t']}")


def cmd_notes_pages(a) -> None:
    n = next((x for x in notes_index() if x["id"] == a.id), None)
    if not n:
        raise SystemExit(f"Unknown notes id {a.id}")
    os.makedirs(a.out, exist_ok=True)
    first = (n.get("index_page") or 2) + 1
    last = n["pages"] if a.last is None else min(a.last, n["pages"])
    for pnum in range(max(a.first or first, 1), last + 1):
        print(page_png(a.id, pnum, Path(a.out) / f"{a.id}_p{pnum:03d}.png"))


def cmd_notes_card(a) -> None:
    from PIL import Image

    n = next((x for x in notes_index() if x["id"] == a.id), None)
    if not n:
        raise SystemExit(f"Unknown notes id {a.id}")
    if not (0 <= a.top < a.bottom <= 1 and 0 <= a.left < a.right <= 1):
        raise SystemExit("crop fractions must satisfy 0 <= top < bottom <= 1 and 0 <= left < right <= 1")
    os.makedirs(a.out, exist_ok=True)
    d = Path(tempfile.mkdtemp())
    full = page_png(a.id, a.page, d / "page.png")
    im = Image.open(full)
    w, h = im.size
    crop = im.crop((int(a.left * w), int(a.top * h), int(a.right * w), int(a.bottom * h)))
    crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    snip = d / f"snip_{a.id}_{a.page}.png"
    crop.save(snip)
    nice = Date.fromisoformat(a.date).strftime("%-d %b")
    kind = "complete" if n.get("full") else "free sample"
    module = module_for(n, a.page)
    lead = a.lead or (
        f"A page from the <b>free {html.escape(n['subject'])} Smaran notes</b>. "
        f"Read the {kind} online: crisp facts, traps and look-alike facts side by side."
    )
    doc = card_html(
        [f"Notes · {nice}", n["subject"], "Free"],
        a.title,
        lead,
        "IMG",
        f"{n['title']} · {module} · page {a.page}" if module else f"{n['title']} · page {a.page}",
        ["Open the link in bio", "Notes tab", f"Open {n['title'].split(' (')[0]} (free, no password)"],
    )
    print(compose(doc, snip, os.path.join(a.out, f"{a.date}_notes_{a.id}_p{a.page}.png")))


def slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-").replace("--", "-")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("promo", help="free-test slide for one subject")
    p.add_argument("--subject", required=True, help="exact subject name on the Subject tests tab")
    p.add_argument("--date", required=True)
    p.add_argument("--slot", default="Today")
    p.add_argument("--title", default="Take these tests <em>free</em>")
    p.add_argument("--lead", required=True, help="one or two sentences; <b>..</b> highlights")
    p.add_argument("--out", default="out")
    p.set_defaults(fn=cmd_promo)

    p = sub.add_parser("notes-list", help="list free notes and their modules")
    p.set_defaults(fn=cmd_notes_list)

    p = sub.add_parser("notes-pages", help="download notes pages as PNG to read")
    p.add_argument("--id", required=True)
    p.add_argument("--first", type=int)
    p.add_argument("--last", type=int)
    p.add_argument("--out", default="pages")
    p.set_defaults(fn=cmd_notes_pages)

    p = sub.add_parser("notes-card", help="crop a block of a notes page into a card")
    p.add_argument("--id", required=True)
    p.add_argument("--page", type=int, required=True)
    p.add_argument("--top", type=float, required=True)
    p.add_argument("--bottom", type=float, required=True)
    p.add_argument("--left", type=float, default=0.06, help="fraction of page width (default trims the margin)")
    p.add_argument("--right", type=float, default=0.94)
    p.add_argument("--date", required=True)
    p.add_argument("--title", default="From our <em>free</em> notes")
    p.add_argument("--lead")
    p.add_argument("--out", default="out")
    p.set_defaults(fn=cmd_notes_card)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
