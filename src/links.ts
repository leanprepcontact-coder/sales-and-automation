import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import type { Channel } from "./flows.js";

function sig(payload: string, len = 16): string {
  return createHmac("sha256", config().LINK_SECRET).update(payload).digest("hex").slice(0, len);
}

/** Compact signed token for a contact id: 32 hex chars + "_" + 16 hex signature (fits Telegram's 64-char start param). */
export function contactToken(contactId: string, purpose: "unsub" | "tg"): string {
  const id = contactId.replace(/-/g, "");
  return `${id}_${sig(`${purpose}:${id}`)}`;
}

export function verifyContactToken(token: string, purpose: "unsub" | "tg"): string | null {
  const m = /^([0-9a-f]{32})_([0-9a-f]{16})$/.exec(token);
  if (!m) return null;
  const expected = Buffer.from(sig(`${purpose}:${m[1]}`));
  const got = Buffer.from(m[2]);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const h = m[1];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function utm(url: string, channel: Channel | "referral", campaign: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", channel === "referral" ? "referral" : "automation");
  u.searchParams.set("utm_medium", channel);
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}

export function pageUrl(hash: string): string {
  return `${config().SITE_URL}/lead-prelims${hash}`;
}

export function unsubscribeUrl(contactId: string): string {
  return `${config().PUBLIC_BASE_URL}/u/${contactToken(contactId, "unsub")}`;
}

export function telegramConnectUrl(contactId: string): string | null {
  const bot = config().TELEGRAM_BOT_USERNAME;
  return bot ? `https://t.me/${bot}?start=${contactToken(contactId, "tg")}` : null;
}

export function referralUrl(code: string): string {
  const u = new URL(pageUrl(""));
  u.searchParams.set("ref", code);
  return utm(u.toString(), "referral", "buyer_referral");
}
