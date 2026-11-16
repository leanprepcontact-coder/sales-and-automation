#!/usr/bin/env python3
"""Renders daily Prelims question posts (1080x1350) in LeanPrep's brand.

Usage:
  python3 scripts/render_post.py --bank qbank.json --id ct-polity-002 --date 2026-11-16 --slot 1 --out out/
  python3 scripts/render_post.py --mains "Question text" --paper GS2 --marks 10 --words 150 --date 2026-11-16 --out out/
  python3 scripts/render_post.py --facts facts.json --date 2026-11-16 --out out/
Writes two PNGs for a Prelims question:
  <date>_Q<slot>_question.png  (for Instagram/Telegram: question + options, "comment your answer")
  <date>_Q<slot>_answer.png    (answer reveal with explanation, for the 8 PM Telegram post / Story)
Needs: playwright (python) with Chrome installed.
"""
import argparse
import html
import json
import os
from datetime import date as Date
from pathlib import Path

from playwright.sync_api import sync_playwright

ASSETS = Path(__file__).resolve().parent.parent / "content" / "assets"
TELEGRAM = "t.me/leanprep"
COURSE_LINK = "leanprep.in/lead-prelims"

CSS = """
@font-face{font-family:'Serif';src:url('instrument-serif-latin-400-normal.woff2')}
@font-face{font-family:'Serif';font-style:italic;src:url('instrument-serif-latin-400-italic.woff2')}
@font-face{font-family:'Sans';font-weight:400;src:url('instrument-sans-latin-400-normal.woff2')}
@font-face{font-family:'Sans';font-weight:500;src:url('instrument-sans-latin-500-normal.woff2')}
@font-face{font-family:'Sans';font-weight:600;src:url('instrument-sans-latin-600-normal.woff2')}
@font-face{font-family:'Sans';font-weight:700;src:url('instrument-sans-latin-700-normal.woff2')}
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0A1628;--or:#FF6B00;--paper:#FFF8F0;--tint:#FBF4E8;--line:#E6DCCB;--mute:#4A5565;--ok:#0F6B3A}
body{width:1080px;height:1350px;background:var(--paper);font-family:'Sans';color:var(--ink);overflow:hidden}
.page{position:absolute;inset:0;display:flex;flex-direction:column;padding:64px 72px 0}
.top{display:flex;align-items:center;justify-content:space-between}
.top img{height:58px}
.tag{font-size:22px;font-weight:600;letter-spacing:.14em;color:var(--or);text-transform:uppercase}
.kicker{margin-top:44px;display:flex;gap:14px;align-items:center}
.pill{border:2px solid var(--ink);border-radius:999px;padding:8px 22px;font-size:24px;font-weight:600}
.pill.or{background:var(--or);border-color:var(--or);color:#fff}
h1{font-family:'Serif';font-weight:400;font-size:64px;line-height:1;margin-top:30px}
h1 em{color:var(--or)}
.body{flex:1;display:flex;flex-direction:column;margin-top:30px;margin-bottom:36px;min-height:0}
.stem{font-size:var(--fs);line-height:1.38;font-weight:500;white-space:pre-line}
.opts{margin-top:26px;display:flex;flex-direction:column;gap:14px}
.opt{display:flex;gap:18px;align-items:center;background:#fff;border:2px solid var(--line);border-radius:18px;padding:16px 22px;font-size:calc(var(--fs) - 2px);line-height:1.3}
.opt b{flex:none;width:44px;height:44px;border-radius:50%;border:2px solid var(--ink);display:grid;place-items:center;font-size:24px}
.opt.right{border-color:var(--ok);background:#EAF6EF}
.opt.right b{background:var(--ok);border-color:var(--ok);color:#fff}
.expl{margin-top:24px;font-size:calc(var(--fs) - 3px);line-height:1.42;color:var(--ink)}
.expl strong{color:var(--ok)}
.link{margin:0 -72px;background:var(--or);color:#fff;padding:14px 72px;font-size:26px;font-weight:600;letter-spacing:.01em}
.foot{margin:0 -72px;background:var(--ink);color:#fff;padding:30px 72px;display:flex;justify-content:space-between;align-items:center}
.foot .l{font-size:30px;font-weight:600}
.foot .l span{color:var(--or)}
.foot .r{font-size:24px;opacity:.85;text-align:right;line-height:1.35}
"""


def page_html(q: dict, day: str, slot: int, reveal: bool) -> str:
    opts = "".join(
        f'<div class="opt{" right" if reveal and k == q["answer"] else ""}"><b>{k}</b><div>{html.escape(v)}</div></div>'
        for k, v in sorted(q["options"].items())
    )
    nice_day = Date.fromisoformat(day).strftime("%-d %b")
    if reveal:
        title = f"Answer: <em>({q['answer']})</em>"
        expl = f'<div class="expl"><strong>Why:</strong> {html.escape(q["explanation"])}</div>'
        foot_l = "Try the full test <span>free</span>"
        foot_r = f"LEAD Prelims 2027<br>{html.escape(q['test'])}"
    else:
        title = "Prelims <em>Daily</em>"
        expl = ""
        foot_l = "Comment <span>a, b, c or d</span>"
        foot_r = f"Answer + explanation tonight, 8 PM<br>on Telegram: {TELEGRAM}"
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="page">
 <div class="top"><img src="logo.png"><div class="tag">LEAD Prelims 2027</div></div>
 <div class="kicker"><span class="pill or">Q{slot} · {nice_day}</span><span class="pill">{html.escape(q['subject'])}</span></div>
 <h1>{title}</h1>
 <div class="body" id="body"><div class="stem">{html.escape(q['stem'])}</div><div class="opts">{opts}</div>{expl}</div>
 <div class="link">Free LEAD Prelims tests → {COURSE_LINK}</div>
 <div class="foot"><div class="l">{foot_l}</div><div class="r">{foot_r}</div></div>
</div></body></html>"""


FIT_JS = """() => {
  const b = document.getElementById('body');
  let fs = 36;
  document.documentElement.style.setProperty('--fs', fs + 'px');
  while (b.scrollHeight > b.clientHeight && fs > 18) {
    fs -= 1; document.documentElement.style.setProperty('--fs', fs + 'px');
  }
  return {fs, overflow: b.scrollHeight > b.clientHeight};
}"""


def render(q: dict, day: str, slot: int, out_dir: str) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1080, "height": 1350})
        for reveal in (False, True):
            tmp = ASSETS / "_post.html"
            tmp.write_text(page_html(q, day, slot, reveal), encoding="utf-8")
            page.goto(tmp.as_uri())
            page.evaluate("document.fonts.ready")
            fit = page.evaluate(FIT_JS)
            if fit["overflow"]:
                raise SystemExit(f"{q['id']}: text does not fit even at 18px; pick another question")
            name = f"{day}_Q{slot}_{'answer' if reveal else 'question'}.png"
            path = os.path.join(out_dir, name)
            page.screenshot(path=path)
            paths.append(path)
        tmp.unlink(missing_ok=True)
        browser.close()
    return paths


def mains_html(question: str, paper: str, marks: str, words: str, day: str) -> str:
    nice_day = Date.fromisoformat(day).strftime("%-d %b")
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}
.q{{font-family:'Serif';font-size:calc(var(--fs) + 26px);line-height:1.18}}
#body{{justify-content:center;padding-bottom:40px}}
.meta{{margin-top:28px;font-size:26px;color:var(--mute);font-weight:500}}
.steps{{margin-top:40px;display:flex;flex-direction:column;gap:16px}}
.step{{display:flex;gap:18px;align-items:center;font-size:28px;font-weight:500}}
.step b{{flex:none;width:48px;height:48px;border-radius:50%;background:var(--or);color:#fff;display:grid;place-items:center;font-size:24px}}
</style></head><body>
<div class="page">
 <div class="top"><img src="logo.png"><div class="tag">Mains Daily</div></div>
 <div class="kicker"><span class="pill or">{nice_day}</span><span class="pill">{html.escape(paper)}</span><span class="pill">UPSC Mains 2026</span></div>
 <h1>Write this <em>answer</em></h1>
 <div class="body" id="body"><div class="q">{html.escape(question)}</div>
  <div class="meta">{html.escape(marks)} marks · {html.escape(words)} words</div>
  <div class="steps">
   <div class="step"><b>1</b>Write it by hand in {html.escape(words)} words</div>
   <div class="step"><b>2</b>Upload a photo at leanprep.in</div>
   <div class="step"><b>3</b>Get a free, detailed evaluation</div>
  </div></div>
 <div class="foot"><div class="l">Free evaluation: <span>link in bio</span></div><div class="r">Mentored Mains prep:<br>LEAD Batch</div></div>
</div></body></html>"""


def render_mains(question: str, paper: str, marks: str, words: str, day: str, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1080, "height": 1350})
        tmp = ASSETS / "_post.html"
        tmp.write_text(mains_html(question, paper, marks, words, day), encoding="utf-8")
        page.goto(tmp.as_uri())
        page.evaluate("document.fonts.ready")
        fit = page.evaluate(FIT_JS)
        if fit["overflow"]:
            raise SystemExit("Mains question too long for one card")
        path = os.path.join(out_dir, f"{day}_Mains.png")
        page.screenshot(path=path)
        tmp.unlink(missing_ok=True)
        browser.close()
    return path


def facts_html(subject: str, facts: list[str], day: str) -> str:
    nice_day = Date.fromisoformat(day).strftime("%-d %b")
    items = "".join(f'<div class="fact"><b>{i}</b><div>{html.escape(f)}</div></div>' for i, f in enumerate(facts, 1))
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}
.facts{{display:flex;flex-direction:column;gap:16px}}
.fact{{display:flex;gap:20px;align-items:flex-start;background:#fff;border:2px solid var(--line);border-radius:18px;padding:18px 24px;font-size:var(--fs);line-height:1.34;font-weight:500}}
.fact b{{flex:none;width:46px;height:46px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:24px;margin-top:2px}}
</style></head><body>
<div class="page">
 <div class="top"><img src="logo.png"><div class="tag">Morning Revision</div></div>
 <div class="kicker"><span class="pill or">{nice_day}</span><span class="pill">{html.escape(subject)}</span></div>
 <h1>5 facts in <em>60 seconds</em></h1>
 <div class="body" id="body"><div class="facts">{items}</div></div>
 <div class="link">Free notes + tests → {COURSE_LINK}</div>
 <div class="foot"><div class="l">Today's quiz at <span>9 AM</span></div><div class="r">Telegram: {TELEGRAM}<br>LEAD Prelims 2027</div></div>
</div></body></html>"""


def render_facts(subject: str, facts: list[str], day: str, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        page = browser.new_page(viewport={"width": 1080, "height": 1350})
        tmp = ASSETS / "_post.html"
        tmp.write_text(facts_html(subject, facts, day), encoding="utf-8")
        page.goto(tmp.as_uri())
        page.evaluate("document.fonts.ready")
        fit = page.evaluate(FIT_JS)
        if fit["overflow"]:
            raise SystemExit("Facts too long for one card; shorten them")
        path = os.path.join(out_dir, f"{day}_Morning_Revision.png")
        page.screenshot(path=path)
        tmp.unlink(missing_ok=True)
        browser.close()
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank")
    ap.add_argument("--id")
    ap.add_argument("--mains", help="Mains question text (renders the Mains card instead)")
    ap.add_argument("--facts", help="JSON file: {\"subject\": ..., \"facts\": [5 short facts]} (renders the Morning Revision card)")
    ap.add_argument("--paper", default="GS2")
    ap.add_argument("--marks", default="10")
    ap.add_argument("--words", default="150")
    ap.add_argument("--date", required=True)
    ap.add_argument("--slot", type=int, default=1)
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    if a.facts:
        d = json.load(open(a.facts))
        print(render_facts(d["subject"], d["facts"], a.date, a.out))
        return
    if a.mains:
        print(render_mains(a.mains, a.paper, a.marks, a.words, a.date, a.out))
        return
    bank = {q["id"]: q for q in json.load(open(a.bank))}
    for p in render(bank[a.id], a.date, a.slot, a.out):
        print(p)


if __name__ == "__main__":
    main()
