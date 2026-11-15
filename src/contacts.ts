import type { Queryable } from "./db.js";

export interface Contact {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  source: string | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  whatsapp_opt_in: boolean;
  email_opt_out: boolean;
  telegram_chat_id: string | null;
  purchased_at: Date | null;
  plan: string | null;
  has_adaptive: boolean;
  created_at: Date;
}

export interface ContactInput {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  source?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  whatsapp_opt_in?: boolean;
}

export function normalizeEmail(e?: string | null): string | null {
  if (!e) return null;
  const v = e.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

/** Normalises Indian numbers to E.164 (+91XXXXXXXXXX). Other numbers must already carry a + prefix. */
export function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  const raw = p.trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 ? `+${digits}` : null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return null;
}

export async function findContact(q: Queryable, email: string | null, phone: string | null): Promise<Contact | null> {
  if (email) {
    const r = await q.query<Contact>("select * from contacts where email = $1", [email]);
    if (r.rows[0]) return r.rows[0];
  }
  if (phone) {
    const r = await q.query<Contact>("select * from contacts where phone = $1", [phone]);
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

/**
 * Finds a contact by email, then phone, and fills in any fields it was missing.
 * Never overwrites known values, and never turns WhatsApp consent off.
 */
export async function upsertContact(q: Queryable, input: ContactInput): Promise<Contact> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) throw new Error("A contact needs a valid email or phone");

  const existing = await findContact(q, email, phone);
  if (existing) {
    // Only attach an email/phone that no other contact already owns.
    const r = await q.query<Contact>(
      `update contacts c set
         email = coalesce(c.email, case when not exists (select 1 from contacts o where o.email = $2) then $2 end),
         phone = coalesce(c.phone, case when not exists (select 1 from contacts o where o.phone = $3) then $3 end),
         name = coalesce(c.name, $4),
         source = coalesce(c.source, $5),
         first_utm_source = coalesce(c.first_utm_source, $6),
         first_utm_campaign = coalesce(c.first_utm_campaign, $7),
         whatsapp_opt_in = c.whatsapp_opt_in or $8
       where c.id = $1 returning *`,
      [existing.id, email, phone, input.name ?? null, input.source ?? null, input.utm_source ?? null,
        input.utm_campaign ?? null, input.whatsapp_opt_in ?? false],
    );
    return r.rows[0];
  }

  const r = await q.query<Contact>(
    `insert into contacts (email, phone, name, source, first_utm_source, first_utm_campaign, whatsapp_opt_in)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict do nothing returning *`,
    [email, phone, input.name ?? null, input.source ?? null, input.utm_source ?? null,
      input.utm_campaign ?? null, input.whatsapp_opt_in ?? false],
  );
  if (r.rows[0]) return r.rows[0];
  // Lost a race with a concurrent insert: read the winner.
  const again = await findContact(q, email, phone);
  if (!again) throw new Error("Contact upsert failed");
  return again;
}

export function firstName(c: Pick<Contact, "name">): string {
  const n = c.name?.trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "there";
}
