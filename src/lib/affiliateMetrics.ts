export type MetricsPeriod = '7d' | '30d' | '90d' | 'all';
export interface MetricReferral { created_at: string; referred_user_id: string | null }
export interface MetricClick { created_at: string; is_automated: boolean; visitor_id?: string | null }
export interface MetricCommission {
  created_at: string; approved_at: string | null; paid_at: string | null;
  referred_user_id: string; commission_amount: number; status: string;
}
export function calculateAffiliateMetrics(referrals: MetricReferral[], commissions: MetricCommission[], period: MetricsPeriod, now = new Date(), clicks: MetricClick[] = [], trackingStartedAt?: string) {
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
  const signups = new Set(selected.flatMap(r => r.referred_user_id ? [r.referred_user_id] : [])).size;
  const buyers = new Set(current.map(c => c.referred_user_id)).size;
  const daily = new Map<string, number>();
  for (const c of current) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(earnedDate(c)));
    daily.set(date, (daily.get(date) ?? 0) + Number(c.commission_amount));
  }
  // Distinct measured people, with each signup proving at least one link access.
  // This repairs the indicator without fabricating historical click events.
  const measuredClicks = new Set(selectedClicks.filter(c => !c.is_automated).map((c, i) => c.visitor_id ?? `access-${i}`)).size;
  return {
    clicks: Math.max(measuredClicks, signups),
    automatedClicks: selectedClicks.filter(c => c.is_automated).length,
    totalAccesses: selectedClicks.length,
    historyUnmeasured: !trackingStartedAt || start < Date.parse(trackingStartedAt),
    trackingStartedAt,
    signups, buyers, earned,
    allBuyers: new Set(earnedRows.map(c => c.referred_user_id)).size,
    conversion: signups > 0 ? buyers / signups * 100 : null,
    averageCommission: buyers > 0 ? earned / buyers : 0,
    pending: sum(commissions.filter(c => c.status === 'pending' && within(c.created_at))),
    paid: sum(commissions.filter(c => c.status === 'paid' && within(c.paid_at ?? c.created_at))),
    growth: previous === null || previous === 0 ? null : (earned - previous) / previous * 100,
    chart: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 })),
  };
}