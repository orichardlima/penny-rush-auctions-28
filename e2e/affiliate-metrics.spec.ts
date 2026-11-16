import { expect, test } from '@playwright/test';
import { calculateAffiliateMetrics, type MetricCommission } from '../src/lib/affiliateMetrics';
const now = new Date('2026-11-15T23:41:00Z');
const referrals = [
  { created_at: '2026-11-14T13:36:12Z', referred_user_id: 'paulo' },
  { created_at: '2026-11-15T17:20:34Z', referred_user_id: 'nelson' },
];
const commission: MetricCommission = { created_at: '2026-11-15T14:43:12Z', approved_at: '2026-11-15T14:43:12Z', paid_at: null, referred_user_id: 'paulo', commission_amount: 12, status: 'approved' };
test.describe('Affiliate indicators without financial writes', () => {
  test('DNGG has one buyer, two signups, 50% conversion and R$12 earned', () => {
    const result = calculateAffiliateMetrics(referrals, [commission], '30d', now);
    expect([result.buyers, result.signups, result.conversion, result.earned, result.averageCommission]).toEqual([1, 2, 50, 12, 12]);
    expect(result.clicks).toBe(0);
    expect(result.historyUnmeasured).toBe(true);
  });
  test('Repurchases do not add another unique buyer', () => {
    expect(calculateAffiliateMetrics(referrals, [commission, { ...commission, commission_amount: 3 }], 'all', now).buyers).toBe(1);
  });
  test('Period excludes old records and compares equal previous windows', () => {
    const old = { ...commission, approved_at: '2026-11-05T12:00:00Z', commission_amount: 6 };
    const result = calculateAffiliateMetrics(referrals, [commission, old], '7d', now);
    expect(result.earned).toBe(12);
    expect(result.growth).toBe(100);
    expect(calculateAffiliateMetrics(referrals, [commission, old], '30d', now).earned).toBe(18);
  });
  test('Pending and cancelled commissions cannot count as earned buyers', () => {
    const result = calculateAffiliateMetrics([], [{ ...commission, status: 'pending' }, { ...commission, status: 'cancelled' }], '30d', now);
    expect([result.buyers, result.earned, result.pending]).toEqual([0, 0, 12]);
  });
  test('No previous earnings means no invented growth rate; records stay unchanged', () => {
    const before = JSON.stringify([referrals, commission]);
    expect(calculateAffiliateMetrics(referrals, [commission], '30d', now).growth).toBeNull();
    expect(JSON.stringify([referrals, commission])).toBe(before);
  });
});
test('Clicks survive signup, automation stays separate and period filters actual events', () => {
  const clicks = [
    { created_at: '2026-11-15T15:00:00Z', is_automated: false },
    { created_at: '2026-11-15T16:00:00Z', is_automated: true },
    { created_at: '2026-11-01T15:00:00Z', is_automated: false },
  ];
  const before = calculateAffiliateMetrics([], [], '7d', now, clicks, '2026-11-01T00:00:00Z');
  const after = calculateAffiliateMetrics(referrals, [commission], '7d', now, clicks, '2026-11-01T00:00:00Z');
  expect([before.clicks, after.clicks, after.automatedClicks, after.totalAccesses]).toEqual([1, 1, 1, 2]);
  expect(after.historyUnmeasured).toBe(false);
  expect(calculateAffiliateMetrics(referrals, [commission], '30d', now, clicks, '2026-11-01T00:00:00Z').historyUnmeasured).toBe(true);
});
test('10 distinct visitors, 5 signups, 3 buyers -> 10 | 5 | 3; repeats do not inflate', async () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const at = '2026-11-16T10:00:00Z';
  const clicks = Array.from({ length: 10 }, (_, i) => ({ created_at: at, is_automated: false, visitor_id: `v${i}` }));
  clicks.push({ created_at: at, is_automated: false, visitor_id: 'v0' }, { created_at: at, is_automated: false, visitor_id: 'v0' });
  clicks.push({ created_at: at, is_automated: true, visitor_id: 'bot' });
  const referrals = Array.from({ length: 5 }, (_, i) => ({ created_at: at, referred_user_id: `u${i}` }));
  const commissions = [0, 1, 2, 2, 2].map(i => ({ created_at: at, approved_at: at, paid_at: null, referred_user_id: `u${i}`, commission_amount: 0, status: 'approved' }));
  const m = calculateAffiliateMetrics(referrals, commissions, '7d', now, clicks, '2026-11-01T00:00:00Z');
  expect([m.clicks, m.signups, m.buyers]).toEqual([10, 5, 3]);
});
