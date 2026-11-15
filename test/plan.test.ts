import { describe, expect, it } from "vitest";
import { flowById, type Channel, type Facts } from "../src/flows.js";
import { isQuietHours, nextQuietEnd, nextRunAt, planStep, MAX_DEFERRALS } from "../src/plan.js";
import { normalizePhone, normalizeEmail } from "../src/contacts.js";

const noSends: Record<Channel, number> = { email: 0, telegram: 0, whatsapp: 0 };
const facts = (over: Partial<Facts> = {}): Facts => ({
  purchased: false,
  hasAdaptive: false,
  testsSinceStart: 0,
  available: { email: true, telegram: true, whatsapp: true },
  ...over,
});
// 14:00 IST and 23:30 IST on 20 Nov 2026
const DAY = new Date("2026-11-20T08:30:00Z");
const NIGHT = new Date("2026-11-20T18:00:00Z");

const A = flowById("a_new_free_user")!;
const C = flowById("c_abandoned_checkout")!;
const D = flowById("d_new_buyer")!;

describe("planStep", () => {
  it("stops sales flows once the contact has bought", () => {
    const p = planStep({ flow: C, stepIndex: 0, facts: facts({ purchased: true }), sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p).toEqual({ kind: "stop", reason: "purchased" });
  });

  it("keeps buyer flows running after purchase", () => {
    const p = planStep({ flow: D, stepIndex: 0, facts: facts({ purchased: true }), sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p.kind).toBe("send");
  });

  it("sends 'all' steps on every reachable channel", () => {
    const p = planStep({ flow: A, stepIndex: 0, facts: facts(), sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "send", channels: ["email", "whatsapp"] });
  });

  it("uses the first reachable channel for 'first' steps", () => {
    const p = planStep({ flow: C, stepIndex: 0, facts: facts(), sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "send", channels: ["whatsapp"] });
  });

  it("falls back to email when there is no WhatsApp consent", () => {
    const f = facts({ available: { email: true, telegram: false, whatsapp: false } });
    const p = planStep({ flow: C, stepIndex: 0, facts: f, sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "send", channels: ["email"] });
  });

  it("falls through to the next channel when WhatsApp hit its daily cap", () => {
    const p = planStep({ flow: C, stepIndex: 0, facts: facts(), sentLast24h: { ...noSends, whatsapp: 1 }, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "send", channels: ["email"] });
  });

  it("waits for 08:00 IST instead of sending WhatsApp at night", () => {
    const p = planStep({ flow: C, stepIndex: 0, facts: facts(), sentLast24h: noSends, deferrals: 0, now: NIGHT });
    expect(p.kind).toBe("defer");
    if (p.kind === "defer") expect(p.until.toISOString()).toBe("2026-11-21T02:30:00.000Z");
  });

  it("still sends email at night when email is the only channel", () => {
    const f = facts({ available: { email: true, telegram: false, whatsapp: false } });
    const p = planStep({ flow: C, stepIndex: 1, facts: f, sentLast24h: noSends, deferrals: 0, now: NIGHT });
    expect(p).toMatchObject({ kind: "send", channels: ["email"] });
  });

  it("skips the test nudge if a test was already taken", () => {
    const p = planStep({ flow: A, stepIndex: 1, facts: facts({ testsSinceStart: 1 }), sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "skip", reason: "condition_not_met" });
  });

  it("skips the Adaptive upsell for buyers who already have it", () => {
    const p = planStep({ flow: D, stepIndex: 1, facts: facts({ purchased: true, hasAdaptive: true }), sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p.kind).toBe("skip");
  });

  it("skips a step nobody can be reached on", () => {
    const f = facts({ available: { email: false, telegram: false, whatsapp: false } });
    const p = planStep({ flow: A, stepIndex: 0, facts: f, sentLast24h: noSends, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "skip", reason: "no_reachable_channel" });
  });

  it("defers an hour when every channel is capped, and gives up after the limit", () => {
    const capped = { email: 2, telegram: 2, whatsapp: 1 };
    const p = planStep({ flow: C, stepIndex: 0, facts: facts(), sentLast24h: capped, deferrals: 0, now: DAY });
    expect(p).toMatchObject({ kind: "defer", reason: "daily_cap" });
    const q = planStep({ flow: C, stepIndex: 0, facts: facts(), sentLast24h: capped, deferrals: MAX_DEFERRALS, now: DAY });
    expect(q.kind).toBe("skip");
  });

  it("completes when there are no steps left", () => {
    expect(planStep({ flow: C, stepIndex: 3, facts: facts(), sentLast24h: noSends, deferrals: 0, now: DAY })).toEqual({ kind: "complete" });
  });
});

describe("timing", () => {
  it("knows IST quiet hours", () => {
    expect(isQuietHours(DAY)).toBe(false);
    expect(isQuietHours(NIGHT)).toBe(true);
    expect(isQuietHours(new Date("2026-11-20T02:00:00Z"))).toBe(true); // 07:30 IST
  });

  it("finds the next 08:00 IST from early morning the same day", () => {
    expect(nextQuietEnd(new Date("2026-11-20T00:00:00Z")).toISOString()).toBe("2026-11-20T02:30:00.000Z");
  });

  it("schedules the next step from the flow start, not from now", () => {
    const start = new Date("2026-11-20T08:00:00Z");
    expect(nextRunAt(C, 0, start, new Date("2026-11-20T08:31:00Z"))?.toISOString()).toBe("2026-11-21T08:00:00.000Z");
    expect(nextRunAt(C, 2, start, start)).toBeNull();
  });
});

describe("normalisation", () => {
  it("normalises Indian phone numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("123")).toBeNull();
  });

  it("normalises emails", () => {
    expect(normalizeEmail("  A.B@Gmail.com ")).toBe("a.b@gmail.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});
