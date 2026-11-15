import { z } from "zod";
import { withTx } from "./db.js";
import { upsertContact, type Contact } from "./contacts.js";
import { enrollForEvent, stopSalesFlows } from "./engine.js";
import type { EventType } from "./flows.js";
import { ensureReferralCode } from "./referrals.js";

export const EventInput = z
  .object({
    type: z.enum(["signup", "test_submitted", "checkout_started", "purchase", "telegram_connected"]),
    email: z.string().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
    whatsapp_opt_in: z.boolean().optional(),
    utm_source: z.string().optional(),
    utm_campaign: z.string().optional(),
    props: z.record(z.unknown()).default({}),
    idempotency_key: z.string().max(200).optional(),
    occurred_at: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => v.email || v.phone, { message: "email or phone is required" });

export type EventInput = z.infer<typeof EventInput>;

export interface RecordResult {
  contactId: string;
  duplicate: boolean;
  enrolled: string[];
}

export async function recordEvent(input: EventInput, source = "api"): Promise<RecordResult> {
  return withTx(async (q) => {
    let contact: Contact = await upsertContact(q, {
      email: input.email, phone: input.phone, name: input.name, source: input.type === "signup" ? "signup" : source,
      utm_source: input.utm_source, utm_campaign: input.utm_campaign, whatsapp_opt_in: input.whatsapp_opt_in,
    });

    const ins = await q.query(
      `insert into events (contact_id, type, props, occurred_at, idempotency_key)
       values ($1, $2, $3, coalesce($4::timestamptz, now()), $5)
       on conflict (idempotency_key) do nothing`,
      [contact.id, input.type, input.props, input.occurred_at ?? null, input.idempotency_key ?? null],
    );
    if (!ins.rowCount) return { contactId: contact.id, duplicate: true, enrolled: [] };

    if (input.type === "purchase") {
      const p = input.props;
      const r = await q.query<Contact>(
        `update contacts set purchased_at = coalesce(purchased_at, now()),
           plan = coalesce($2, plan), has_adaptive = has_adaptive or $3
         where id = $1 returning *`,
        [contact.id, typeof p.plan === "string" ? p.plan : null, p.adaptive === true],
      );
      contact = r.rows[0];
      await stopSalesFlows(q, contact.id, "purchased");
      await ensureReferralCode(q, contact.id, contact.name);
    }

    const enrolled = await enrollForEvent(q, contact, input.type as EventType, input.props);
    return { contactId: contact.id, duplicate: false, enrolled };
  });
}
