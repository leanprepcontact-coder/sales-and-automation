"""Post one LeanPrep Telegram slot (8am, 9am, 115pm, 6pm, 8pm).

Asks the Growth OS Apps Script feed what to post, posts it through the bot,
then asks the feed to write the Post Log row. Run by .github/workflows/telegram-posts.yml.
Env: TG_TOKEN (bot token), GAS_URL (Apps Script web app /exec URL), FEED_KEY.
"""
import base64
import os
import sys
import time

import requests

CHANNEL = "-1003815350454"
TOKEN = os.environ["TG_TOKEN"]
FEED = os.environ["GAS_URL"]
KEY = os.environ["FEED_KEY"]


def tg(method, **kw):
    for attempt in range(5):
        r = requests.post(f"https://api.telegram.org/bot{TOKEN}/{method}", timeout=120, **kw).json()
        if r.get("ok"):
            return r["result"]
        wait = (r.get("parameters") or {}).get("retry_after")
        if r.get("error_code") == 429 and wait and attempt < 4:
            time.sleep(wait + 2)
            continue
        raise RuntimeError(f"{method}: {r.get('description')}")


def feed(**params):
    r = requests.get(FEED, params={"key": KEY, **params}, timeout=300).json()
    if not r.get("ok"):
        raise RuntimeError(f"feed: {r.get('error')}")
    return r


def main(slot):
    me = tg("getMe")
    data = feed(action="pending", slot=slot)
    items = data["items"]
    print(f"Bot @{me['username']} | {data['date']} slot {slot}: {len(items)} item(s) to post")
    failed = 0
    for it in items:
        label = it["label"]
        try:
            if it["type"] == "photo":
                img = base64.b64decode(it["image_b64"])
                files = {"photo": ("card.png", img, it.get("mime") or "image/png")}
                cap = it["caption"]
                if len(cap) <= 1024:
                    tg("sendPhoto", data={"chat_id": CHANNEL, "caption": cap}, files=files)
                else:  # photo captions stop at 1024 characters
                    tg("sendPhoto", data={"chat_id": CHANNEL}, files=files)
                    tg("sendMessage", json={"chat_id": CHANNEL, "text": cap, "link_preview_options": {"is_disabled": True}})
                result = "Posted with card + caption by bot (GitHub)"
            else:
                tg("sendPoll", json={
                    "chat_id": CHANNEL, "question": it["question"],
                    "options": [{"text": o} for o in it["options"]],
                    "type": "quiz", "correct_option_id": it["correct"],
                    "is_anonymous": True, "explanation": it["explanation"],
                })
                result = f"Quiz poll posted by bot (GitHub), answer {'abcd'[it['correct']]}"
            feed(action="log", slot=slot, label=label, result=result)
            print(f"  posted: {label}")
        except Exception as e:  # keep going with the other posts
            failed += 1
            print(f"  FAILED: {label}: {e}")
            try:
                feed(action="log", slot=slot, label=label, result=f"Failed: {e}"[:300])
            except Exception:
                pass
        time.sleep(3)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1])
