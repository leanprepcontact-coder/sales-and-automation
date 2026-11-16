#!/usr/bin/env python3
"""Turns a session-registration CSV (Google Form export) into a prioritised outreach list.

Usage:
  python3 scripts/session_leads.py <form.csv> --session "14 Nov" --out leads.csv

For each unique person it decides the offer (LEAD-Prelims or 1:1 Mentorship), a priority
score, a topic from the question they asked, a personal WhatsApp message, and a one-tap
wa.me link that opens WhatsApp with the message typed in (sent by a person, not a bot).
Columns are matched by keywords, so other LeanPrep form exports with similar questions work too.
"""
import argparse
import csv
import re
from urllib.parse import quote

PRELIMS_LINK = "https://leanprep.in/lead-prelims"
MENTOR_LINK = "https://leanprep.in/mentorship"

TOPICS = [
    (r"\bcsat\b|aptitude|\bmaths?\b|quant|reasoning", "CSAT"),
    (r"current affair|\bca\b|newspaper|\bnews\b", "current affairs"),
    (r"(prelim|\bpre\b).*(mains)|(mains).*(prelim|\bpre\b)|integrat", "balancing Prelims and Mains"),
    (r"answer writ|ethics|essay|gs ?4|optional", "Mains answer writing"),
    (r"\bmains\b", "Mains preparation"),
    (r"\bnotes?\b|revision|revise", "notes and revision"),
    (r"\btime\b|schedul|routine|consisten|motivat|mental|burn|distract|focus|stress|anxiety|discipline", "planning your day and staying consistent"),
    (r"prelim|mcq|elimination|test series|\bmocks?\b", "Prelims strategy"),
    (r"\bstart|beginner|basic|ncert|foundation|syllabus", "where to start"),
]
MAINS_TOPICS = {"Mains answer writing", "Mains preparation"}


def col(headers, *keys):
    for h in headers:
        if all(k in h.lower() for k in keys):
            return h
    return None


def topic_of(q: str) -> str:
    ql = q.lower()
    for pat, name in TOPICS:
        if re.search(pat, ql):
            return name
    return "your preparation strategy" if q.strip() else ""


def first_name(n: str) -> str:
    n = (n or "").strip().split()
    return n[0].capitalize() if n else "there"


def phone10(p: str) -> str:
    d = re.sub(r"\D", "", p or "")
    if len(d) == 12 and d.startswith("91"):
        d = d[2:]
    if len(d) == 11 and d.startswith("0"):
        d = d[1:]
    return d if len(d) == 10 and d[0] in "6789" else ""


def message(offer: str, name: str, topic: str, session: str) -> str:
    asked = f" You asked about {topic}." if topic else ""
    if offer == "Mentorship":
        return (
            f"Hi {name}, this is Team LeanPrep. Thank you for joining Rahul Shekhar sir's strategy session on {session}.{asked}\n\n"
            "Since you've already written Mains, generic advice won't move your score much. What helps is a mentor reading your own answers "
            "and telling you exactly what to fix.\n\n"
            "LeanPrep 1:1 Mentorship lets you pick a verified mentor and book a session, usually within 24 hours.\n"
            f"Book here: {MENTOR_LINK}\n\n"
            "Want me to suggest the right mentor for your optional and stage?"
        )
    return (
        f"Hi {name}, this is Team LeanPrep. Thank you for joining Rahul Shekhar sir's strategy session on {session}.{asked}\n\n"
        "LEAD-Prelims 2027, the course we showed in the session, is designed and reviewed by Rahul sir: Smaran notes, concept tests, "
        "15 mocks, 5 Open Tests with All-India rank, and adaptive tests built from your own mistakes.\n\n"
        + ("For answer writing, you can also get your Mains answers evaluated free at leanprep.in.\n\n" if topic in MAINS_TOPICS else "")
        + "Pre-sale is 50% off until 30 November. You can try real tests free first:\n"
        f"{PRELIMS_LINK}\n\n"
        "Shall I tell you which plan fits your attempt?"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--session", default="14 Nov")
    ap.add_argument("--out", default="leads.csv")
    a = ap.parse_args()

    rows = list(csv.DictReader(open(a.csv, encoding="utf-8-sig")))
    H = list(rows[0].keys())
    c_email, c_name, c_phone = col(H, "email"), col(H, "name"), col(H, "whatsapp") or col(H, "phone")
    c_attempt, c_status, c_stage = col(H, "attempt"), col(H, "status"), col(H, "how far")
    c_opt, c_q, c_src = col(H, "optional"), col(H, "question"), col(H, "hear")
    g = lambda r, c: (r.get(c) or "").strip() if c else ""

    seen, out = set(), []
    for r in rows:
        email, ph = g(r, c_email).lower(), phone10(g(r, c_phone))
        key = email or ph
        if not key or key in seen or (ph and ph in seen):
            continue
        seen.update(k for k in (email, ph) if k)

        stage, attempt, status, q = g(r, c_stage), g(r, c_attempt), g(r, c_status), g(r, c_q)
        mains_stage = bool(re.search(r"mains|interview", stage, re.I))
        offer = "Mentorship" if mains_stage else "LEAD-Prelims"
        topic = topic_of(q)

        score = 0
        score += 2 if "full" in status.lower() else 0
        score += 2 if re.search(r"appeared in prelims", stage, re.I) else 0  # Prelims repeaters: Prelims is their wall
        score += 3 if mains_stage else 0
        score += 1 if re.search(r"second|third|fourth", attempt, re.I) else 0
        score += 1 if len(q) > 15 else 0
        score += 1 if topic == "CSAT" else 0
        priority = "A" if score >= 6 else "B" if score >= 4 else "C"

        name = g(r, c_name).title()
        msg = message(offer, first_name(name), topic, a.session)
        wa = f"https://wa.me/91{ph}?text={quote(msg)}" if ph else ""
        out.append({
            "Priority": priority, "Score": score, "Offer": offer, "Name": name, "Email": email,
            "WhatsApp": ph, "Attempt (2027)": attempt, "Stage": stage, "Status": status,
            "Optional": g(r, c_opt), "Their question": q, "Topic": topic, "Heard via": g(r, c_src),
            "Message": msg, "Open WhatsApp": wa, "Owner": "", "Outreach status": "To contact", "Notes": "",
        })

    out.sort(key=lambda x: (-x["Score"], x["Name"]))
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)
    from collections import Counter
    print(len(rows), "rows ->", len(out), "unique people")
    print("offer:", dict(Counter(x["Offer"] for x in out)))
    print("priority:", dict(Counter(x["Priority"] for x in out)))
    print("no valid WhatsApp:", sum(1 for x in out if not x["WhatsApp"]))
    print("topics:", Counter(x["Topic"] for x in out).most_common())


if __name__ == "__main__":
    main()
