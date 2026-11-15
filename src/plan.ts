// Pure decision logic: given a flow, where a contact is in it, and what we know,
// decide what happens next. No I/O here, so it is fully unit-tested.
import {
  DAILY_CAPS, QUIET_END_HOUR_IST, QUIET_START_HOUR_IST,
  type Channel, type Facts, type Flow, type Step,
} from "./flows.js";

export type Plan =
  | { kind: "stop"; reason: string }
  | { kind: "complete" }
  | { kind: "skip"; step: Step; reason: string }
  | { kind: "defer"; until: Date; reason: string }
  | { kind: "send"; step: Step; channels: Channel[] };

export const MAX_DEFERRALS = 24;
const IST_OFFSET_MIN = 330;

export function istHour(d: Date): number {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000).getUTCHours();
}

export function isQuietHours(d: Date): boolean {
  const h = istHour(d);
  return h >= QUIET_START_HOUR_IST || h < QUIET_END_HOUR_IST;
}

/** Next 08:00 IST at or after d. */
export function nextQuietEnd(d: Date): Date {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  const target = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), QUIET_END_HOUR_IST));
  if (ist.getUTCHours() >= QUIET_END_HOUR_IST) target.setUTCDate(target.getUTCDate() + 1);
  return new Date(target.getTime() - IST_OFFSET_MIN * 60_000);
}

const isRealtime = (c: Channel) => c === "telegram" || c === "whatsapp";

export function planStep(args: {
  flow: Flow;
  stepIndex: number;
  facts: Facts;
  sentLast24h: Record<Channel, number>;
  deferrals: number;
  now: Date;
}): Plan {
  const { flow, stepIndex, facts, sentLast24h, deferrals, now } = args;

  if (flow.stopOnPurchase && facts.purchased) return { kind: "stop", reason: "purchased" };

  const step = flow.steps[stepIndex];
  if (!step) return { kind: "complete" };

  if (step.when && !step.when(facts)) return { kind: "skip", step, reason: "condition_not_met" };

  const quiet = isQuietHours(now);
  const reachable = step.channels.filter((c) => facts.available[c]);
  if (reachable.length === 0) return { kind: "skip", step, reason: "no_reachable_channel" };

  const underCap = (c: Channel) => sentLast24h[c] < DAILY_CAPS[c];
  const canDefer = deferrals < MAX_DEFERRALS;
  const toMorning: Plan = { kind: "defer", until: nextQuietEnd(now), reason: "quiet_hours" };

  if (step.mode === "first") {
    // Walk channels in preference order. A capped channel falls through to the next one;
    // a preferred channel blocked only by quiet hours waits for the morning instead.
    for (const c of reachable) {
      if (!underCap(c)) continue;
      if (quiet && isRealtime(c)) {
        if (canDefer) return toMorning;
        continue;
      }
      return { kind: "send", step, channels: [c] };
    }
  } else {
    // "all": wait for morning so every channel goes out together.
    if (quiet && reachable.some(isRealtime) && canDefer) return toMorning;
    const chosen = reachable.filter((c) => underCap(c) && !(quiet && isRealtime(c)));
    if (chosen.length) return { kind: "send", step, channels: chosen };
  }

  if (!canDefer) return { kind: "skip", step, reason: "deferred_too_long" };
  return { kind: "defer", until: new Date(now.getTime() + 60 * 60_000), reason: "daily_cap" };
}

/** When the step after `stepIndex` is due, or null if the flow is finished. */
export function nextRunAt(flow: Flow, stepIndex: number, startedAt: Date, now: Date): Date | null {
  const next = flow.steps[stepIndex + 1];
  if (!next) return null;
  const due = new Date(startedAt.getTime() + next.offsetMinutes * 60_000);
  return due > now ? due : now;
}
