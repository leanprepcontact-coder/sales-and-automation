import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { config } from "./config.js";
import { db } from "./db.js";
import { EventInput, recordEvent } from "./events.js";
import { purchaseFromWebhook, verifyRazorpaySignature } from "./razorpay.js";
import { stats } from "./stats.js";
import { telegramConnectUrl, verifyContactToken } from "./links.js";
import { normalizeEmail, normalizePhone, findContact } from "./contacts.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

function safeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function apiKeyOk(req: FastifyRequest): boolean {
  return safeEqual(req.headers["x-api-key"] as string | undefined, config().EVENTS_API_KEY);
}

export function buildApp() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, bodyLimit: 1_000_000 });

  // Keep the raw body: Razorpay signs the exact bytes it sends.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    req.rawBody = body as string;
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  app.get("/health", async () => ({ ok: true, mode: config().SEND_MODE }));

  // The website (or any test script) reports funnel events here.
  app.post("/events", async (req, reply) => {
    if (!apiKeyOk(req)) return reply.code(401).send({ error: "unauthorized" });
    const parsed = EventInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return await recordEvent(parsed.data);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.post("/webhooks/razorpay", async (req, reply) => {
    const ok = verifyRazorpaySignature(req.rawBody ?? "", req.headers["x-razorpay-signature"] as string | undefined, config().RAZORPAY_WEBHOOK_SECRET);
    if (!ok) return reply.code(401).send({ error: "bad signature" });
    const ev = purchaseFromWebhook(req.body);
    if (!ev) return { ignored: true };
    return recordEvent(ev, "razorpay");
  });

  // Telegram calls this when someone opens the bot via their "Connect Telegram" link.
  app.post("/webhooks/telegram", async (req, reply) => {
    const secret = config().TELEGRAM_WEBHOOK_SECRET;
    if (!secret || !safeEqual(req.headers["x-telegram-bot-api-secret-token"] as string | undefined, secret)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const msg = (req.body as { message?: { text?: string; chat?: { id: number } } }).message;
    const m = /^\/start\s+(\S+)/.exec(msg?.text ?? "");
    if (!m || !msg?.chat) return { ok: true };
    const contactId = verifyContactToken(m[1], "tg");
    if (!contactId) return { ok: true };
    await db().query("update contacts set telegram_chat_id = null where telegram_chat_id = $1 and id <> $2", [msg.chat.id, contactId]);
    await db().query("update contacts set telegram_chat_id = $2 where id = $1", [contactId, msg.chat.id]);
    return { ok: true };
  });

  // The website asks for a contact's personal "Connect Telegram" link to show after sign-up.
  // POST, so emails and phone numbers never end up in URLs or access logs.
  app.post("/contacts/telegram-link", async (req, reply) => {
    if (!apiKeyOk(req)) return reply.code(401).send({ error: "unauthorized" });
    const qs = (req.body ?? {}) as { email?: string; phone?: string };
    const c = await findContact(db(), normalizeEmail(qs.email), normalizePhone(qs.phone));
    if (!c) return reply.code(404).send({ error: "not found" });
    return { url: telegramConnectUrl(c.id), connected: Boolean(c.telegram_chat_id) };
  });

  app.get("/u/:token", async (req, reply) => {
    const id = verifyContactToken((req.params as { token: string }).token, "unsub");
    reply.type("text/html");
    if (!id) return reply.code(400).send("<p>This unsubscribe link is not valid.</p>");
    await db().query("update contacts set email_opt_out = true where id = $1", [id]);
    return "<p style='font-family:Arial'>You've been unsubscribed from LeanPrep emails.</p>";
  });

  app.get("/stats", async (req, reply) => {
    if (!apiKeyOk(req)) return reply.code(401).send({ error: "unauthorized" });
    return stats(db());
  });

  return app;
}
