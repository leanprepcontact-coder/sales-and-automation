import { config } from "./config.js";
import type { Queryable } from "./db.js";

export async function stats(q: Queryable, now = new Date()) {
  const c = config();
  const start = new Date(`${c.CAMPAIGN_START}T00:00:00+05:30`);
  const end = new Date(`${c.CAMPAIGN_END}T23:59:59+05:30`);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const elapsedDays = Math.min(totalDays, Math.max(0, (now.getTime() - start.getTime()) / 86_400_000));
  const todayIst = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const todayStart = new Date(`${todayIst}T00:00:00+05:30`);

  const one = async <T>(sql: string, params: unknown[] = []) => (await q.query(sql, params)).rows[0] as T;
  const many = async <T>(sql: string, params: unknown[] = []) => (await q.query(sql, params)).rows as T[];

  const funnel = await one<Record<string, string>>(
    `select
       count(*) filter (where type = 'signup') signups,
       count(distinct contact_id) filter (where type = 'test_submitted') test_takers,
       count(distinct contact_id) filter (where type = 'checkout_started') checkouts,
       count(*) filter (where type = 'purchase') purchases,
       coalesce(sum((props->>'amount_inr')::numeric) filter (where type = 'purchase'), 0) revenue_inr
     from events where occurred_at between $1 and $2`,
    [start, end],
  );
  const today = await one<{ n: string }>(
    "select count(*) n from events where type = 'purchase' and occurred_at >= $1",
    [todayStart],
  );
  const recovery = await one<{ checkouts: string; recovered: string }>(
    `select count(distinct co.contact_id) checkouts,
            count(distinct co.contact_id) filter (where exists (
              select 1 from events p where p.contact_id = co.contact_id and p.type = 'purchase'
                and p.occurred_at between co.occurred_at and co.occurred_at + interval '7 days')) recovered
     from events co where co.type = 'checkout_started' and co.occurred_at between $1 and $2`,
    [start, end],
  );
  const bySource = await many(
    `select coalesce(c.first_utm_source, c.source, 'unknown') source, count(*) purchases
     from events e join contacts c on c.id = e.contact_id
     where e.type = 'purchase' and e.occurred_at between $1 and $2
     group by 1 order by 2 desc`,
    [start, end],
  );
  const byPlan = await many(
    `select coalesce(props->>'plan', 'unknown') plan, count(*) purchases,
            coalesce(sum((props->>'amount_inr')::numeric), 0) revenue_inr
     from events where type = 'purchase' and occurred_at between $1 and $2
     group by 1 order by 2 desc`,
    [start, end],
  );
  const topReferrers = await many(
    `select e.props->>'ref_code' code, c.name, count(*) referred_sales
     from events e left join referral_codes r on r.code = e.props->>'ref_code'
     left join contacts c on c.id = r.contact_id
     where e.type = 'purchase' and e.props->>'ref_code' is not null and e.occurred_at between $1 and $2
     group by 1, 2 order by 3 desc limit 10`,
    [start, end],
  );
  const messages = await many(
    `select channel, status, count(*) n from messages where created_at between $1 and $2 group by 1, 2 order by 1, 2`,
    [start, end],
  );

  const purchases = Number(funnel.purchases);
  const checkouts = Number(recovery.checkouts);
  return {
    target: c.TARGET_SALES,
    campaign: { start: c.CAMPAIGN_START, end: c.CAMPAIGN_END, day: Math.ceil(elapsedDays), of: totalDays },
    sales: {
      total: purchases,
      today: Number(today.n),
      expectedByNow: Math.round((c.TARGET_SALES * elapsedDays) / totalDays),
      neededPerDayFromNow: Math.max(0, Math.ceil((c.TARGET_SALES - purchases) / Math.max(1, totalDays - elapsedDays))),
    },
    revenueInr: Number(funnel.revenue_inr),
    funnel: {
      signups: Number(funnel.signups),
      testTakers: Number(funnel.test_takers),
      checkouts: Number(funnel.checkouts),
      purchases,
    },
    abandonedCheckoutRecovery: {
      checkouts,
      recovered: Number(recovery.recovered),
      rate: checkouts ? Number(recovery.recovered) / checkouts : null,
    },
    bySource,
    byPlan,
    topReferrers,
    messages,
  };
}
