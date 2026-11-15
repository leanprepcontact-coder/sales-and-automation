// End-to-end against a real Postgres. Runs only when TEST_DATABASE_URL is set:
//   TEST_DATABASE_URL=postgres://... npm test
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("end to end (dry run)", () => {
  let mod: {
    db: typeof import("../src/db.js");
    events: typeof import("../src/events.js");
    engine: typeof import("../src/engine.js");
    app: typeof import("../src/app.js");
  };

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: url, EVENTS_API_KEY: "test-key-123", LINK_SECRET: "link-secret-123",
      PUBLIC_BASE_URL: "https://auto.test", SEND_MODE: "dry_run", RAZORPAY_WEBHOOK_SECRET: "rzp-secret",
      TELEGRAM_BOT_USERNAME: "leanprep_test_bot", TELEGRAM_WEBHOOK_SECRET: "tg-secret", COURSE_START: "2026-12-01",
      LOG_LEVEL: "silent",
    });
    mod = {
      db: await import("../src/db.js"),
      events: await import("../src/events.js"),
      engine: await import("../src/engine.js"),
      app: await import("../src/app.js"),
    };
    const sql = readFileSync(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
    await mod.db.db().query("drop table if exists referral_codes, messages, enrollments, events, contacts cascade");
    await mod.db.db().query(sql);
  });

  afterAll(async () => {
    await mod?.db.closeDb();
  });

  const q = (sql: string, p: unknown[] = []) => mod.db.db().query(sql, p);
  const hours = (n: number) => new Date(Date.now() + n * 3600_000);

  it("runs the free-user and abandoned-checkout flows, then stops them on purchase", async () => {
    const { recordEvent } = mod.events;
    const r = await recordEvent({ type: "signup", email: "Asha@Example.com", phone: "9876543210", name: "asha verma", whatsapp_opt_in: true, utm_source: "telegram", props: {} });
    expect(r.enrolled).toEqual(["a_new_free_user"]);

    // Same person signs up again: no second enrolment.
    const again = await recordEvent({ type: "signup", email: "asha@example.com", props: {} });
    expect(again.contactId).toBe(r.contactId);
    expect(again.enrolled).toEqual([]);

    // Welcome goes out (dry run) on email + WhatsApp. Run at a daytime IST hour.
    const noon = new Date();
    noon.setUTCHours(7, 0, 0, 0); // 12:30 IST
    const day = noon > new Date() ? noon : new Date(noon.getTime() + 86400_000);
    await q("update enrollments set next_run_at = now() - interval '1 minute'");
    await mod.engine.tick(day);
    const m1 = await q("select channel, template, status, rendered from messages order by id");
    expect(m1.rows.map((x) => `${x.channel}:${x.template}:${x.status}`)).toEqual([
      "email:a_welcome:dry_run",
      "whatsapp:a_welcome:dry_run",
    ]);
    expect(m1.rows[0].rendered.subject).toContain("diagnostic");
    expect(m1.rows[0].rendered.text).toContain("Hi Asha,");
    expect(m1.rows[0].rendered.text).toContain("utm_campaign=a_new_free_user_welcome");
    expect(m1.rows[0].rendered.text).toContain("t.me/leanprep_test_bot?start=");

    // Ticking again sends nothing new (idempotent).
    await mod.engine.tick(day);
    expect((await q("select count(*)::int n from messages")).rows[0].n).toBe(2);

    // Checkout started, then abandoned.
    const co = await recordEvent({ type: "checkout_started", email: "asha@example.com", props: { checkout_url: "https://leanprep.in/app/batches/lead-prelims?buy=gs_csat" } });
    expect(co.enrolled).toEqual(["c_abandoned_checkout"]);
    await q("update enrollments set next_run_at = now() - interval '1 minute' where flow_id = 'c_abandoned_checkout'");
    await mod.engine.tick(new Date(day.getTime() + 3600_000));
    // WhatsApp already used today (cap 1), so the 30-minute reminder falls back to email.
    const c1 = await q("select channel, rendered from messages where template = 'c_saved'");
    expect(c1.rows).toHaveLength(1);
    expect(c1.rows[0].channel).toBe("email");
    expect(c1.rows[0].rendered.text).toContain("buy=gs_csat");

    // Purchase via a signed Razorpay webhook stops both sales flows and starts the buyer flow.
    const app = mod.app.buildApp();
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", amount: 294882, currency: "INR", email: "asha@example.com", contact: "+919876543210", notes: { plan: "gs_csat", adaptive: "true" } } } },
    });
    const sig = createHmac("sha256", "rzp-secret").update(body).digest("hex");
    const res = await app.inject({ method: "POST", url: "/webhooks/razorpay", payload: body, headers: { "content-type": "application/json", "x-razorpay-signature": sig } });
    expect(res.statusCode).toBe(200);
    expect(res.json().enrolled).toEqual(["d_new_buyer"]);

    // Replayed webhook is ignored.
    const dup = await app.inject({ method: "POST", url: "/webhooks/razorpay", payload: body, headers: { "content-type": "application/json", "x-razorpay-signature": sig } });
    expect(dup.json().duplicate).toBe(true);

    // Bad signature rejected.
    const bad = await app.inject({ method: "POST", url: "/webhooks/razorpay", payload: body, headers: { "content-type": "application/json", "x-razorpay-signature": "00" } });
    expect(bad.statusCode).toBe(401);

    const flows = await q("select flow_id, status, stop_reason from enrollments order by id");
    expect(flows.rows).toEqual([
      { flow_id: "a_new_free_user", status: "stopped", stop_reason: "purchased" },
      { flow_id: "c_abandoned_checkout", status: "stopped", stop_reason: "purchased" },
      { flow_id: "d_new_buyer", status: "active", stop_reason: null },
    ]);

    const contact = (await q("select * from contacts")).rows[0];
    expect(contact.has_adaptive).toBe(true);
    expect(contact.first_utm_source).toBe("telegram");
    const code = (await q("select code from referral_codes")).rows[0].code as string;
    expect(code).toMatch(/^ASHA[A-Z2-9]{4}$/);

    // Buyer welcome includes the referral link.
    await mod.engine.tick(new Date(day.getTime() + 2 * 3600_000));
    const dw = await q("select rendered from messages where template = 'd_welcome' and channel = 'email'");
    expect(dw.rows[0].rendered.text).toContain(`ref=${code}`);

    // Stats endpoint.
    const st = await app.inject({ method: "GET", url: "/stats", headers: { "x-api-key": "test-key-123" } });
    expect(st.statusCode).toBe(200);
    expect(st.json().funnel.purchases).toBe(1);
    expect(st.json().revenueInr).toBe(2948.82);
    expect(st.json().abandonedCheckoutRecovery.recovered).toBe(1);
    await app.close();
  });

  it("rejects events without the API key and links Telegram via /start", async () => {
    const app = mod.app.buildApp();
    const no = await app.inject({ method: "POST", url: "/events", payload: { type: "signup", email: "x@y.com" } });
    expect(no.statusCode).toBe(401);

    const ok = await app.inject({ method: "POST", url: "/events", headers: { "x-api-key": "test-key-123" }, payload: { type: "signup", email: "ravi@example.com", name: "Ravi" } });
    expect(ok.statusCode).toBe(200);

    const link = await app.inject({ method: "POST", url: "/contacts/telegram-link", headers: { "x-api-key": "test-key-123" }, payload: { email: "ravi@example.com" } });
    const token = new URL(link.json().url).searchParams.get("start");
    const tg = await app.inject({
      method: "POST", url: "/webhooks/telegram", headers: { "x-telegram-bot-api-secret-token": "tg-secret" },
      payload: { message: { text: `/start ${token}`, chat: { id: 555001 } } },
    });
    expect(tg.statusCode).toBe(200);
    const c = (await q("select telegram_chat_id from contacts where email = 'ravi@example.com'")).rows[0];
    expect(String(c.telegram_chat_id)).toBe("555001");

    // A forged token is ignored.
    await app.inject({
      method: "POST", url: "/webhooks/telegram", headers: { "x-telegram-bot-api-secret-token": "tg-secret" },
      payload: { message: { text: `/start ${"0".repeat(32)}_${"0".repeat(16)}`, chat: { id: 999 } } },
    });
    expect((await q("select count(*)::int n from contacts where telegram_chat_id = 999")).rows[0].n).toBe(0);
    await app.close();
  });

  it("nudges buyers who have not taken a test in 7 days, once a week", async () => {
    await q("update contacts set purchased_at = now() - interval '10 days' where email = 'asha@example.com'");
    const after = new Date("2026-12-05T07:00:00Z");
    const n1 = await mod.engine.sweepInactiveBuyers(mod.db.db(), after);
    const n2 = await mod.engine.sweepInactiveBuyers(mod.db.db(), after);
    expect(n1).toBe(1);
    expect(n2).toBe(0);
    // Not before the course starts.
    expect(await mod.engine.sweepInactiveBuyers(mod.db.db(), new Date("2026-11-20T07:00:00Z"))).toBe(0);
  });

  it("unsubscribe link works and stops email", async () => {
    const { unsubscribeUrl } = await import("../src/links.js");
    const id = (await q("select id from contacts where email = 'ravi@example.com'")).rows[0].id;
    const app = mod.app.buildApp();
    const path = new URL(unsubscribeUrl(id)).pathname;
    const r = await app.inject({ method: "GET", url: path });
    expect(r.statusCode).toBe(200);
    expect((await q("select email_opt_out from contacts where id = $1", [id])).rows[0].email_opt_out).toBe(true);
    await app.close();
  });
});
