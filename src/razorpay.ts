import { createHmac, timingSafeEqual } from "node:crypto";
import type { EventInput } from "./events.js";

export function verifyRazorpaySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

interface RazorpayPayment {
  id: string;
  amount: number; // paise
  currency: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string> | unknown[];
}

/**
 * Maps a `payment.captured` webhook to a purchase event.
 * Plan details are read from the payment's notes: plan, adaptive ("true"/"false"), ref_code, name.
 * The website must set these notes when it creates the Razorpay order.
 */
export function purchaseFromWebhook(body: unknown): EventInput | null {
  const b = body as { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } };
  if (b.event !== "payment.captured") return null;
  const p = b.payload?.payment?.entity;
  if (!p) return null;
  const notes = (Array.isArray(p.notes) ? {} : p.notes ?? {}) as Record<string, string>;
  if (!p.email && !p.contact) return null;
  return {
    type: "purchase",
    email: p.email,
    phone: p.contact,
    name: notes.name,
    props: {
      payment_id: p.id,
      amount_inr: p.amount / 100,
      currency: p.currency,
      plan: notes.plan ?? null,
      adaptive: notes.adaptive === "true",
      ref_code: notes.ref_code ? notes.ref_code.toUpperCase() : null,
    },
    idempotency_key: `razorpay:${p.id}`,
  };
}
