#!/usr/bin/env python3
"""Builds the LEAD-Prelims free-question bank from the course page's public PDFs.

Usage:  python3 scripts/qbank.py [--site URL] [--out qbank.json]

Reads <site>/data/items.json, downloads every free GS test's Questions and Answers PDF,
and writes one JSON record per question:
  id, test_id, test, subject, number, stem, options{a..d}, answer, explanation, test_url
CSAT tests are skipped (social posts use GS questions). Needs curl and pdftotext.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

DEFAULT_SITE = "https://bejewelled-biscuit-6f2caa.netlify.app"
NOISE = re.compile(r"^(LeanPrep|Page \d+|\d+\s*/\s*\d+|\d+|leanprep\.in.*)$", re.I)
# Running headers/footers, which pdftotext sometimes glues onto the end of a text line.
FOOTER = re.compile(r"\s*(LEANPREP · .*|LeanPrep · .*(Tests|leanprep\.in).*)$")


def fetch(url: str, out: str) -> None:
    subprocess.run(["curl", "-sSfL", "-m", "60", "-o", out, url], check=True)


def pdf_text(path: str) -> list[str]:
    txt = subprocess.run(["pdftotext", "-raw", path, "-"], check=True, capture_output=True, text=True).stdout
    lines = [FOOTER.sub("", l).rstrip() for l in txt.splitlines()]
    return [l for l in lines if l.strip() and not NOISE.match(l.strip())]


def parse_questions(lines: list[str]) -> dict[int, dict]:
    qs: dict[int, dict] = {}
    expected = 1
    cur = None
    field = None
    for line in lines:
        m = re.match(rf"^{expected}\.\s+(.*)$", line)
        # A new question starts only once the previous one has its (d) option.
        if m and (cur is None or "d" in cur["options"]):
            cur = {"stem": m.group(1), "options": {}}
            qs[expected] = cur
            expected += 1
            field = "stem"
            continue
        if cur is None:
            continue
        o = re.match(r"^\(([a-d])\)\s*(.*)$", line)
        if o and (o.group(1) == "a" or field in ("a", "b", "c")):
            field = o.group(1)
            cur["options"][field] = o.group(2)
            continue
        if field == "stem":
            cur["stem"] += "\n" + line
        elif field in cur["options"]:
            cur["options"][field] += " " + line
    return qs


def parse_answers(lines: list[str]) -> dict[int, tuple[str, str]]:
    out: dict[int, tuple[str, str]] = {}
    text = "\n".join(lines)
    start = text.find("\nAnswers\n")
    body = text[start:] if start >= 0 else text
    parts = re.split(r"\n?Q(\d+)\s*·\s*\(([a-d])\)\s*", body)
    # parts = [pre, num, ans, expl, num, ans, expl, ...]
    for i in range(1, len(parts) - 2, 3):
        expl = re.sub(r"\s*\n\s*", " ", parts[i + 2]).strip()
        out[int(parts[i])] = (parts[i + 1], expl)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=DEFAULT_SITE)
    ap.add_argument("--out", default="qbank.json")
    args = ap.parse_args()
    site = args.site.rstrip("/")

    tmp = tempfile.mkdtemp()
    items_path = os.path.join(tmp, "items.json")
    fetch(f"{site}/data/items.json", items_path)
    items = json.load(open(items_path))

    bank, problems = [], []
    for it in items:
        if it.get("mode") != "online" or not it.get("q") or not it.get("a") or it.get("section") == "CSAT":
            continue
        qp, ap_ = os.path.join(tmp, "q.pdf"), os.path.join(tmp, "a.pdf")
        fetch(f"{site}/{it['q']}", qp)
        fetch(f"{site}/{it['a']}", ap_)
        qs = parse_questions(pdf_text(qp))
        ans = parse_answers(pdf_text(ap_))
        test_name = f"{it['subject']} · {it['type']}" if it["subject"] != "All subjects" else it["type"]
        for n, q in sorted(qs.items()):
            if n not in ans or len(q["options"]) != 4:
                problems.append(f"{it['id']} Q{n}")
                continue
            bank.append({
                "id": f"{it['id']}-{n:03d}",
                "test_id": it["id"],
                "test": test_name,
                "section": it["section"],
                "subject": it["subject"],
                "number": n,
                "stem": q["stem"].strip(),
                "options": q["options"],
                "answer": ans[n][0],
                "explanation": ans[n][1],
                "test_url": f"{site}/#subjects",
            })
        expected = int(it.get("count") or 0)
        got = sum(1 for b in bank if b["test_id"] == it["id"])
        if expected and got != expected:
            problems.append(f"{it['id']}: parsed {got} of {expected}")

    json.dump(bank, open(args.out, "w"), ensure_ascii=False, indent=1)
    print(f"{len(bank)} questions written to {args.out}")
    if problems:
        print("Problems:", "; ".join(problems[:30]), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
