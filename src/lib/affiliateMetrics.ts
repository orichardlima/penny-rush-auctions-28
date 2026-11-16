export type MetricsPeriod = '7d' | '30d' | '90d' | 'all';
export interface MetricReferral { created_at: string; referred_user_id: string | null; click_source?: string | null; user_agent?: string | null }
export interface MetricClick { created_at: string; is_automated: boolean; visitor_id?: string | null }
export interface MetricCommission {
  created_at: string; approved_at: string | null; paid_at: string | null;
  referred_user_id: string; commission_amount: number; status: string;
}
export type LegacyClass = 'measured' | 'inferred' | 'linked' | 'inconclusive';
const ATTRIBUTION_WINDOW_MS = 30 * 86400000;
// Old rows: a real browser visit (URL + UA), a signup whose code came from the
// link (direct_signup, no event) counted once as an inferred historical visit
// while the 30-day window can still reach before the new tracking start, a
// signup already linked to a measured visit, or manual/unknown (no click).
export function classifyReferral(r: MetricReferral, trackingStartedAt: string | undefined, linkedUsers: Set<string>): LegacyClass {
  if (r.click_source?.startsWith('http') && r.user_agent !== 'no_click_tracked') return 'measured';
  if (r.referred_user_id && linkedUsers.has(r.referred_user_id)) return 'linked';
  const start = trackingStartedAt ? Date.parse(trackingStartedAt) : Infinity;
  if (r.click_source === 'direct_signup' && r.referred_user_id && Date.parse(r.created_at) < start + ATTRIBUTION_WINDOW_MS) return 'inferred';
  return 'inconclusive';
}
export function calculateAffiliateMetrics(referrals: MetricReferral[], commissions: MetricCommission[], period: MetricsPeriod, now = new Date(), clicks: MetricClick[] = [], trackingStartedAt?: string, linkedUsers: Set<string> = new Set()) {
  const end = now.getTime();
  const days = period === 'all' ? null : Number(period.slice(0, -1));
  const start = days === null ? -Infinity : end - days * 86400000;
  const previousStart = days === null ? -Infinity : start - days * 86400000;
  const within = (date: string, from = start, to = end) => {
    const time = Date.parse(date);
    return time >= from && time < to;
  };
  const selected = referrals.filter(r => within(r.created_at));
  const selectedClicks = clicks.filter(c => within(c.created_at));
  const earnedRows = commissions.filter(c => ['approved', 'paid'].includes(c.status));
  const earnedDate = (c: MetricCommission) => c.approved_at ?? c.created_at;
  const current = earnedRows.filter(c => within(earnedDate(c)));
  const sum = (rows: MetricCommission[]) => Math.round(rows.reduce((n, c) => n + Number(c.commission_amount), 0) * 100) / 100;
  const earned = sum(current);
  const previous = days === null ? null : sum(earnedRows.filter(c => within(earnedDate(c), previousStart, start)));
  const signupUsers = new Set(selected.flatMap(r => r.referred_user_id ? [r.referred_user_id] : []));
  // Buyer = referred person with a validated purchase, dated by the first purchase.
  const firstPurchase = new Map<string, string>();
  for (const c of earnedRows) {
    const prev = firstPurchase.get(c.referred_user_id);
    if (!prev || Date.parse(c.created_at) < Date.parse(prev)) firstPurchase.set(c.referred_user_id, c.created_at);
  }
  const buyers = [...firstPurchase.values()].filter(d => within(d)).length;
  const cohortBuyers = [...signupUsers].filter(u => firstPurchase.has(u)).length;
  const daily = new Map<string, number>();
  for (const c of current) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(earnedDate(c)));
    daily.set(date, (daily.get(date) ?? 0) + Number(c.commission_amount));
  }
  const measuredNew = new Set(selectedClicks.filter(c => !c.is_automated).map((c, i) => c.visitor_id ?? `access-${i}`)).size;
  const classes = selected.map(r => classifyReferral(r, trackingStartedAt, linkedUsers));
  const measuredLegacy = classes.filter(c => c === 'measured').length;
  const inferredUsers = new Set(selected.filter((r, i) => classes[i] === 'inferred').map(r => r.referred_user_id));
  const inferredClicks = inferredUsers.size;
  const measuredClicks = measuredNew + measuredLegacy;
  const clickCount = measuredClicks + inferredClicks;
  return {
    clicks: clickCount,
    measuredClicks, inferredClicks,
    inconclusiveSignups: classes.filter(c => c === 'inconclusive').length,
    automatedClicks: selectedClicks.filter(c => c.is_automated).length,
    totalAccesses: selectedClicks.length,
    trackingStartedAt,
    signups: signupUsers.size, buyers, earned,
    allBuyers: firstPurchase.size,
    signupRate: clickCount > 0 ? signupUsers.size / clickCount * 100 : null,
    conversion: signupUsers.size > 0 ? cohortBuyers / signupUsers.size * 100 : null,
    averageCommission: buyers > 0 ? earned / buyers : 0,
    pending: sum(commissions.filter(c => c.status === 'pending' && within(c.created_at))),
    paid: sum(commissions.filter(c => c.status === 'paid' && within(c.paid_at ?? c.created_at))),
    growth: previous === null || previous === 0 ? null : (earned - previous) / previous * 100,
    chart: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 })),
  };
}
