import { randomInt } from "node:crypto";
import type { Queryable } from "./db.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function makeCode(name: string | null): string {
  const base = (name ?? "").split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "LP";
  let tail = "";
  for (let i = 0; i < 4; i++) tail += ALPHABET[randomInt(ALPHABET.length)];
  return `${base}${tail}`;
}

/** Returns the contact's referral code, creating one if needed. */
export async function ensureReferralCode(q: Queryable, contactId: string, name: string | null): Promise<string> {
  const existing = await q.query<{ code: string }>("select code from referral_codes where contact_id = $1", [contactId]);
  if (existing.rows[0]) return existing.rows[0].code;
  for (let i = 0; i < 10; i++) {
    const code = makeCode(name);
    const r = await q.query<{ code: string }>(
      "insert into referral_codes (code, contact_id) values ($1, $2) on conflict do nothing returning code",
      [code, contactId],
    );
    if (r.rows[0]) return r.rows[0].code;
    const mine = await q.query<{ code: string }>("select code from referral_codes where contact_id = $1", [contactId]);
    if (mine.rows[0]) return mine.rows[0].code;
  }
  throw new Error("Could not allocate a referral code");
}

export async function referralCodeFor(q: Queryable, contactId: string): Promise<string | null> {
  const r = await q.query<{ code: string }>("select code from referral_codes where contact_id = $1", [contactId]);
  return r.rows[0]?.code ?? null;
}
