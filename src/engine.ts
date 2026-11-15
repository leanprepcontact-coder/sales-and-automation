// Runs the flows: enrols contacts when events arrive, and on each tick sends whatever is due.
import type pg from "pg";
import { config } from "./config.js";
import { db, type Queryable } from "./db.js";
import { firstName, type Contact } from "./contacts.js";
import { FLOWS, flowById, type Channel, type EventType, type Facts, type Flow } from "./flows.js";
import { planStep, nextRunAt } from "./plan.js";
import { hasChannel, render, type Vars } from "./templates.js";
import { deliver } from "./channels.js";
import { pageUrl, referralUrl, telegramConnectUrl, unsubscribeUrl, utm } from "./links.js";
import { referralCodeFor } from "./referrals.js";

export const SALES_FLOW_IDS = FLOWS.filter((f) => f.stopOnPurchase).map((f) => f.id);
const RETRY_LIMIT = 3;

interface EnrollmentRow {
  id: string;
  contact_id: string;
  flow_id: string;
  step_index: number;
  started_at: Date;
  next_run_at: Date;
  status: string;
  context: Record<string, unknown>;
  deferrals: number;
}

export async function enroll(q: Queryable, contact: Contact, flow: Flow, context: Record<string, unknown>, now = new Date()): Promise<boolean> {
  if (flow.requiresNotPurchased && contact.purchased_at) return false;
  if (flow.once) {
    const prior = await q.query("select 1 from enrollments where contact_id = $1 and flow_id = $2 limit 1", [contact.id, flow.id]);
    if (prior.rowCount) return false;
  }
  const first = flow.steps[0];
  const due = new Date(now.getTime() + first.offsetMinutes * 60_000);
  const r = await q.query(
    `insert into enrollments (contact_id, flow_id, started_at, next_run_at, context)
     values ($1, $2, $3, $4, $5)
     on conflict (contact_id, flow_id) where status = 'active' do nothing`,
    [contact.id, flow.id, now, due, context],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function enrollForEvent(q: Queryable, contact: Contact, type: EventType, props: Record<string, unknown>): Promise<string[]> {
  const entered: string[] = [];
  for (const flow of FLOWS.filter((f) => f.trigger === type)) {
    if (await enroll(q, contact, flow, props)) entered.push(flow.id);
  }
  return entered;
}

export async function stopSalesFlows(q: Queryable, contactId: string, reason: string): Promise<void> {
  await q.query(
    `update enrollments set status = 'stopped', stop_reason = $3
     where contact_id = $1 and status = 'active' and flow_id = any($2)`,
    [contactId, SALES_FLOW_IDS, reason],
  );
}

function reachable(c: Contact, ch: Channel): boolean {
  if (ch === "email") return Boolean(c.email) && !c.email_opt_out;
  if (ch === "telegram") return Boolean(c.telegram_chat_id);
  return Boolean(c.phone) && c.whatsapp_opt_in;
}

async function loadFacts(q: Queryable, c: Contact, e: EnrollmentRow, template: string | undefined): Promise<Facts> {
  const tests = await q.query<{ n: string }>(
    "select count(*) n from events where contact_id = $1 and type = 'test_submitted' and occurred_at >= $2",
    [c.id, e.started_at],
  );
  const channels: Channel[] = ["email", "telegram", "whatsapp"];
  const available = Object.fromEntries(
    channels.map((ch) => [ch, reachable(c, ch) && (!template || hasChannel(template, ch))]),
  ) as Record<Channel, boolean>;
  return { purchased: Boolean(c.purchased_at), hasAdaptive: c.has_adaptive, testsSinceStart: Number(tests.rows[0].n), available };
}

async function sentLast24h(q: Queryable, contactId: string, now: Date): Promise<Record<Channel, number>> {
  const r = await q.query<{ channel: Channel; n: string }>(
    `select channel, count(*) n from messages
     where contact_id = $1 and created_at > $2 and status in ('pending','sent','dry_run')
     group by channel`,
    [contactId, new Date(now.getTime() - 24 * 3600_000)],
  );
  const out: Record<Channel, number> = { email: 0, telegram: 0, whatsapp: 0 };
  for (const row of r.rows) out[row.channel] = Number(row.n);
  return out;
}

async function buildVars(q: Queryable, c: Contact, e: EnrollmentRow, channel: Channel, stepKey: string): Promise<Vars> {
  const campaign = `${e.flow_id}_${stepKey}`;
  const code = await referralCodeFor(q, c.id);
  const ctx = e.context ?? {};
  const checkout = typeof ctx.checkout_url === "string" && ctx.checkout_url ? ctx.checkout_url : pageUrl("#plans");
  const deadline = config().OFFER_DEADLINE_TEXT;
  return {
    name: firstName(c),
    plansUrl: utm(pageUrl("#plans"), channel, campaign),
    freeUrl: utm(pageUrl("#free"), channel, campaign),
    checkoutUrl: utm(checkout, channel, campaign),
    courseUrl: utm(`${config().SITE_URL}/app/batches/lead-prelims`, channel, campaign),
    referralCode: code,
    referralUrl: code ? referralUrl(code) : null,
    telegramConnectUrl: c.telegram_chat_id ? null : telegramConnectUrl(c.id),
    unsubscribeUrl: unsubscribeUrl(c.id),
    deadlineLine: deadline ? deadline : "",
    testName: typeof ctx.test_name === "string" ? ctx.test_name : null,
    score: ctx.score !== undefined && ctx.score !== null ? String(ctx.score) : null,
  };
}

async function advance(q: Queryable, e: EnrollmentRow, flow: Flow, now: Date): Promise<void> {
  const next = nextRunAt(flow, e.step_index, e.started_at, now);
  if (next) {
    await q.query("update enrollments set step_index = step_index + 1, next_run_at = $2, deferrals = 0 where id = $1", [e.id, next]);
  } else {
    await q.query("update enrollments set status = 'completed', step_index = step_index + 1 where id = $1", [e.id]);
  }
}

export interface TickResult {
  processed: number;
  sent: number;
  dryRun: number;
  failed: number;
}

/** Process one due enrollment inside its own transaction. */
async function processOne(client: pg.PoolClient, id: string, now: Date, out: TickResult): Promise<void> {
  const er = await client.query<EnrollmentRow>(
    "select * from enrollments where id = $1 and status = 'active' and next_run_at <= $2 for update skip locked",
    [id, now],
  );
  const e = er.rows[0];
  if (!e) return;
  out.processed++;

  const flow = flowById(e.flow_id);
  if (!flow) {
    await client.query("update enrollments set status = 'stopped', stop_reason = 'unknown_flow' where id = $1", [e.id]);
    return;
  }
  const c = (await client.query<Contact>("select * from contacts where id = $1", [e.contact_id])).rows[0];
  const step = flow.steps[e.step_index];
  const facts = await loadFacts(client, c, e, step?.template);
  const plan = planStep({
    flow, stepIndex: e.step_index, facts, sentLast24h: await sentLast24h(client, c.id, now), deferrals: e.deferrals, now,
  });

  switch (plan.kind) {
    case "stop":
      await client.query("update enrollments set status = 'stopped', stop_reason = $2 where id = $1", [e.id, plan.reason]);
      return;
    case "complete":
      await client.query("update enrollments set status = 'completed' where id = $1", [e.id]);
      return;
    case "skip":
      await advance(client, e, flow, now);
      return;
    case "defer":
      await client.query("update enrollments set next_run_at = $2, deferrals = deferrals + 1 where id = $1", [e.id, plan.until]);
      return;
    case "send": {
      let anyFailed = false;
      for (const channel of plan.channels) {
        const vars = await buildVars(client, c, e, channel, plan.step.key);
        const rendered = render(plan.step.template, channel, vars);
        // Claim the slot first, so a crash or a second worker can never double-send.
        const claim = await client.query<{ id: string }>(
          `insert into messages (contact_id, enrollment_id, flow_id, step_key, channel, template, status, rendered)
           values ($1,$2,$3,$4,$5,$6,'pending',$7)
           on conflict (enrollment_id, step_key, channel)
             do update set status = 'pending', error = null, created_at = now()
             where messages.status = 'failed'
           returning id`,
          [c.id, e.id, flow.id, plan.step.key, channel, plan.step.template, rendered],
        );
        if (!claim.rows[0]) continue; // already sent earlier
        try {
          const res = await deliver(channel, c, rendered, vars.unsubscribeUrl);
          await client.query("update messages set status = $2, provider_id = $3 where id = $1", [claim.rows[0].id, res.status, res.providerId ?? null]);
          if (res.status === "dry_run") out.dryRun++;
          else out.sent++;
        } catch (err) {
          anyFailed = true;
          out.failed++;
          await client.query("update messages set status = 'failed', error = $2 where id = $1", [claim.rows[0].id, String(err).slice(0, 500)]);
        }
      }
      if (anyFailed && e.deferrals < RETRY_LIMIT) {
        // Retry the failed channel(s) in 15 minutes; channels that worked are not re-sent.
        await client.query("update enrollments set next_run_at = $2, deferrals = deferrals + 1 where id = $1", [e.id, new Date(now.getTime() + 15 * 60_000)]);
      } else {
        await advance(client, e, flow, now);
      }
    }
  }
}

/** Enrols buyers who have not taken a test in 7 days into flow E (at most once a week each). */
export async function sweepInactiveBuyers(q: Queryable, now = new Date()): Promise<number> {
  if (now < new Date(`${config().COURSE_START}T00:00:00+05:30`)) return 0;
  const flow = flowById("e_inactive_buyer")!;
  const week = new Date(now.getTime() - 7 * 24 * 3600_000);
  const r = await q.query<Contact>(
    `select c.* from contacts c
     where c.purchased_at is not null and c.purchased_at < $1
       and not exists (select 1 from events ev where ev.contact_id = c.id and ev.type = 'test_submitted' and ev.occurred_at > $1)
       and not exists (select 1 from enrollments en where en.contact_id = c.id and en.flow_id = $2 and en.started_at > $1)
     limit 500`,
    [week, flow.id],
  );
  let n = 0;
  for (const c of r.rows) if (await enroll(q, c, flow, {}, now)) n++;
  return n;
}

export async function tick(now = new Date()): Promise<TickResult & { swept: number }> {
  const out: TickResult = { processed: 0, sent: 0, dryRun: 0, failed: 0 };
  const lock = await db().connect();
  try {
    const got = await lock.query<{ ok: boolean }>("select pg_try_advisory_lock(727001) ok");
    if (!got.rows[0].ok) return { ...out, swept: 0 }; // another worker is running
    try {
      const swept = await sweepInactiveBuyers(db(), now);
      const due = await db().query<{ id: string }>(
        "select id from enrollments where status = 'active' and next_run_at <= $1 order by next_run_at limit 200",
        [now],
      );
      for (const { id } of due.rows) {
        const client = await db().connect();
        try {
          await client.query("begin");
          await processOne(client, id, now, out);
          await client.query("commit");
        } catch (err) {
          await client.query("rollback");
          console.error(`enrollment ${id} failed`, err);
        } finally {
          client.release();
        }
      }
      return { ...out, swept };
    } finally {
      await lock.query("select pg_advisory_unlock(727001)");
    }
  } finally {
    lock.release();
  }
}
