# LeanPrep sales automation

A standalone service that runs the LEAD-Prelims 2027 sales flows. It records funnel events and sends follow-ups on email (Azure), Telegram and WhatsApp. It starts in **dry-run mode**: nothing is sent, and every message is written to the `messages` table so you can read it first.

## The five flows

| Flow | Starts when | Messages |
| --- | --- | --- |
| `a_new_free_user` | `signup` | Welcome (email + WhatsApp) → day 1 test nudge if no test yet → day 3 proof → day 5 offer |
| `b_first_test` | first `test_submitted` | Score + course pitch after 5 min |
| `c_abandoned_checkout` | `checkout_started` | 30 min, 24 h, 72 h reminders with the checkout link |
| `d_new_buyer` | `purchase` | Welcome + referral code → day 3 Adaptive upsell (only if not bought) → day 5 referral ask |
| `e_inactive_buyer` | daily sweep, from course start | Nudge buyers with no test in 7 days, at most once a week |

Rules applied to every message:

- **Purchase stops all sales flows (A, B, C) immediately.**
- **Daily caps per person:** 2 emails, 1 WhatsApp, 2 Telegram messages.
- **No Telegram or WhatsApp between 22:00 and 08:00 IST.** Those messages wait until morning.
- **WhatsApp is off by default (`WHATSAPP_ENABLED=false`).** WhatsApp steps then fall back to email or Telegram. When it is on, WhatsApp only goes to people who opted in. Telegram only goes to people who connected the bot.
- **Every email has an unsubscribe link.**

Flows are defined in `src/flows.ts`. Message copy is in `src/templates.ts`.

## Setup

1. Create a Neon database and run `migrations/001_init.sql` in its SQL editor.
2. Copy `.env.example` to `.env` and fill it in. Keep `SEND_MODE=dry_run`.
3. Install and start the service:
   ```
   npm install
   npm run dev
   ```
4. Optional: import your existing list.
   ```
   npm run import -- masterclass.csv --source masterclass_list
   ```

## Sending events

Send each funnel event to `POST /events` with the header `x-api-key: <EVENTS_API_KEY>`:

```json
{ "type": "signup", "email": "a@b.com", "phone": "9876543210", "name": "Asha",
  "whatsapp_opt_in": true, "utm_source": "telegram", "utm_campaign": "results_post" }

{ "type": "test_submitted", "email": "a@b.com", "props": { "test_name": "Prelims Demo 25", "score": "42/50" } }

{ "type": "checkout_started", "email": "a@b.com", "props": { "checkout_url": "https://leanprep.in/app/batches/lead-prelims?buy=gs_csat" } }
```

`purchase` usually comes from the Razorpay webhook (below), but it can also be sent here with `props: { plan, adaptive, amount_inr, ref_code }` and an `idempotency_key`.

## Razorpay

Point a Razorpay webhook for `payment.captured` at `POST /webhooks/razorpay` and set `RAZORPAY_WEBHOOK_SECRET`.

When the website creates an order, it should add these **notes**: `plan`, `adaptive` (`"true"`/`"false"`), `ref_code` and `name`. Replayed webhooks are ignored.

## Telegram

1. Create a bot with @BotFather. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`.
2. Register the webhook:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_BASE_URL>/webhooks/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. After sign-up, the website calls `POST /contacts/telegram-link` with `{ "email": ... }` and shows the returned link as a "Connect Telegram" button.

## WhatsApp

The service uses the Meta WhatsApp Cloud API. Templates must be approved first; see `docs/whatsapp-templates.md`.

## Dashboard data

`GET /stats` (with the API key) returns:

- Sales vs the 500 target, and the pace needed per day
- Revenue
- Funnel counts
- Abandoned-checkout recovery rate
- Sales by source and by plan
- Top referrers
- Message counts by channel and status

## Going live checklist

- [ ] Read a day of dry-run messages in the `messages` table
- [ ] Azure sender domain verified for `hello@leanprep.in`
- [ ] WhatsApp templates approved
- [ ] Telegram webhook set
- [ ] Razorpay webhook set
- [ ] Set `OFFER_DEADLINE_TEXT` once a real deadline is decided
- [ ] Switch `SEND_MODE=live`

## Tests

```
npm test                                         # unit tests
TEST_DATABASE_URL=postgres://... npm test        # + end-to-end on a throwaway database
```
