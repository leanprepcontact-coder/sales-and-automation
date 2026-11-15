// The five automated flows from the LEAD-Prelims sales plan (doc section 5).
// Offsets are minutes from when the contact entered the flow.

export type Channel = "email" | "telegram" | "whatsapp";
export type EventType = "signup" | "test_submitted" | "checkout_started" | "purchase" | "telegram_connected";

export interface Facts {
  purchased: boolean;
  hasAdaptive: boolean;
  testsSinceStart: number;
  available: Record<Channel, boolean>;
}

export interface Step {
  key: string;
  offsetMinutes: number;
  template: string;
  /** "all": every available channel. "first": the first available channel, in order. */
  mode: "all" | "first";
  channels: Channel[];
  when?: (f: Facts) => boolean;
}

export interface Flow {
  id: string;
  trigger: EventType | null; // null = entered by a scheduled sweep
  /** Only enter if the contact has not bought. */
  requiresNotPurchased: boolean;
  /** Stop the flow the moment the contact buys. */
  stopOnPurchase: boolean;
  /** A contact can only ever go through this flow once. */
  once: boolean;
  steps: Step[];
}

const H = 60;
const D = 24 * H;

export const FLOWS: Flow[] = [
  {
    id: "a_new_free_user",
    trigger: "signup",
    requiresNotPurchased: true,
    stopOnPurchase: true,
    once: true,
    steps: [
      { key: "welcome", offsetMinutes: 0, template: "a_welcome", mode: "all", channels: ["email", "whatsapp"] },
      {
        key: "nudge_test", offsetMinutes: 1 * D, template: "a_nudge_test", mode: "first",
        channels: ["telegram", "email"], when: (f) => f.testsSinceStart === 0,
      },
      { key: "proof", offsetMinutes: 3 * D, template: "a_proof", mode: "all", channels: ["email"] },
      { key: "offer", offsetMinutes: 5 * D, template: "a_offer", mode: "first", channels: ["whatsapp", "email"] },
    ],
  },
  {
    id: "b_first_test",
    trigger: "test_submitted",
    requiresNotPurchased: true,
    stopOnPurchase: true,
    once: true,
    steps: [{ key: "score", offsetMinutes: 5, template: "b_score", mode: "all", channels: ["email", "telegram"] }],
  },
  {
    id: "c_abandoned_checkout",
    trigger: "checkout_started",
    requiresNotPurchased: true,
    stopOnPurchase: true,
    once: false,
    steps: [
      { key: "saved", offsetMinutes: 30, template: "c_saved", mode: "first", channels: ["whatsapp", "email"] },
      { key: "payment_help", offsetMinutes: 1 * D, template: "c_payment_help", mode: "all", channels: ["email"] },
      { key: "last", offsetMinutes: 3 * D, template: "c_last", mode: "first", channels: ["whatsapp", "email"] },
    ],
  },
  {
    id: "d_new_buyer",
    trigger: "purchase",
    requiresNotPurchased: false,
    stopOnPurchase: false,
    once: true,
    steps: [
      { key: "welcome", offsetMinutes: 0, template: "d_welcome", mode: "all", channels: ["email", "whatsapp"] },
      {
        key: "adaptive_upsell", offsetMinutes: 3 * D, template: "d_adaptive_upsell", mode: "all",
        channels: ["email"], when: (f) => !f.hasAdaptive,
      },
      { key: "referral", offsetMinutes: 5 * D, template: "d_referral", mode: "first", channels: ["whatsapp", "email"] },
    ],
  },
  {
    id: "e_inactive_buyer",
    trigger: null,
    requiresNotPurchased: false,
    stopOnPurchase: false,
    once: false,
    steps: [
      { key: "nudge", offsetMinutes: 0, template: "e_nudge", mode: "first", channels: ["telegram", "whatsapp", "email"] },
    ],
  },
];

export function flowById(id: string): Flow | undefined {
  return FLOWS.find((f) => f.id === id);
}

/** Max messages per contact per channel in any rolling 24 hours. */
export const DAILY_CAPS: Record<Channel, number> = { email: 2, whatsapp: 1, telegram: 2 };

/** Telegram and WhatsApp are not sent between 22:00 and 08:00 IST. */
export const QUIET_START_HOUR_IST = 22;
export const QUIET_END_HOUR_IST = 8;
