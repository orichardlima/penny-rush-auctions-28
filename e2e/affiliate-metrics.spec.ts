import { expect, test } from '@playwright/test';
import { calculateAffiliateMetrics, classifyReferral, type MetricCommission } from '../src/lib/affiliateMetrics';
const now = new Date('2026-11-15T23:41:00Z');
const START = '2026-11-15T23:56:46Z';
const referrals = [
  { created_at: '2026-11-14T13:36:12Z', referred_user_id: 'paulo', click_source: 'direct_signup', user_agent: 'no_click_tracked' },
  { created_at: '2026-11-15T17:20:34Z', referred_user_id: 'nelson', click_source: 'direct_signup', user_agent: 'no_click_tracked' },
];
const commission: MetricCommission = { created_at: '2026-11-15T14:43:12Z', approved_at: '2026-11-15T14:43:12Z', paid_at: null, referred_user_id: 'paulo', commission_amount: 12, status: 'approved' };
test.describe('Affiliate indicators without financial writes', () => {
  test('DNGG shows 2 clicks (both historical inferred), 2 signups, 1 buyer and R$12', () => {
    const result = calculateAffiliateMetrics(referrals, [commission], '30d', now, [], START);
    expect([result.clicks, result.measuredClicks, result.inferredClicks, result.signups, result.buyers]).toEqual([2, 0, 2, 2, 1]);
    expect([result.conversion, result.earned]).toEqual([50, 12]);
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
test('Automation stays separate and the period filters real events', () => {
  const clicks = [
    { created_at: '2026-11-15T15:00:00Z', is_automated: false, visitor_id: 'a' },
    { created_at: '2026-11-15T16:00:00Z', is_automated: true, visitor_id: 'bot' },
    { created_at: '2026-11-01T15:00:00Z', is_automated: false, visitor_id: 'b' },
  ];
  const m = calculateAffiliateMetrics([], [], '7d', now, clicks, START);
  expect([m.clicks, m.automatedClicks, m.totalAccesses]).toEqual([1, 1, 2]);
});
test('New signups never become clicks automatically after the attribution window', () => {
  const late = { created_at: '2026-12-20T10:00:00Z', referred_user_id: 'x', click_source: 'direct_signup', user_agent: 'no_click_tracked' };
  const m = calculateAffiliateMetrics([late], [], '7d', new Date('2026-12-21T00:00:00Z'), [], START);
  expect([m.clicks, m.signups, m.inconclusiveSignups]).toEqual([0, 1, 1]);
});
test('Signup linked to a measured visit is not counted twice', () => {
  const at = '2026-11-16T10:00:00Z';
  const r = { created_at: '2026-11-16T10:05:00Z', referred_user_id: 'u', click_source: 'direct_signup', user_agent: 'no_click_tracked' };
  const m = calculateAffiliateMetrics([r], [], '7d', new Date('2026-11-17T00:00:00Z'), [{ created_at: at, is_automated: false, visitor_id: 'v' }], START, new Set(['u']));
  expect([m.clicks, m.measuredClicks, m.inferredClicks]).toEqual([1, 1, 0]);
});
test('Legacy classification: real visit, inferred, manual and orphan rows', () => {
  const none = new Set<string>();
  expect(classifyReferral({ created_at: '2025-12-02T17:51:05Z', referred_user_id: null, click_source: 'https://showdelances.com/?ref=AFILIA0CB5', user_agent: 'Mozilla' }, START, none)).toBe('measured');
  expect(classifyReferral({ created_at: '2026-03-01T00:00:00Z', referred_user_id: 'p', click_source: 'direct_signup', user_agent: 'no_click_tracked' }, START, none)).toBe('inferred');
  expect(classifyReferral({ created_at: '2025-12-02T17:02:18Z', referred_user_id: 'p', click_source: 'manual_admin_link', user_agent: 'x' }, START, none)).toBe('inconclusive');
  expect(classifyReferral({ created_at: '2026-01-14T21:10:45Z', referred_user_id: null, click_source: 'direct_signup', user_agent: 'no_click_tracked' }, START, none)).toBe('inconclusive');
});
test('10 distinct visitors, 5 signups, 3 buyers -> 10 | 5 | 3; repeats do not inflate', async () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const at = '2026-11-16T10:00:00Z';
  const clicks = Array.from({ length: 10 }, (_, i) => ({ created_at: at, is_automated: false, visitor_id: `v${i}` }));
  clicks.push({ created_at: at, is_automated: false, visitor_id: 'v0' }, { created_at: at, is_automated: false, visitor_id: 'v0' });
  clicks.push({ created_at: at, is_automated: true, visitor_id: 'bot' });
  const referrals = Array.from({ length: 5 }, (_, i) => ({ created_at: at, referred_user_id: `u${i}` }));
  const commissions = [0, 1, 2, 2, 2].map(i => ({ created_at: at, approved_at: at, paid_at: null, referred_user_id: `u${i}`, commission_amount: 0, status: 'approved' }));
  const m = calculateAffiliateMetrics(referrals.map(r => ({ ...r, click_source: 'direct_signup', user_agent: 'no_click_tracked' })), commissions, '7d', now, clicks, '2026-11-01T00:00:00Z', new Set(referrals.map(r => r.referred_user_id)));
  expect([m.clicks, m.signups, m.buyers]).toEqual([10, 5, 3]);
});
