import { test, expect } from '@playwright/test';
import { createAffiliateClickCapture } from '../src/lib/affiliateClickCapture';
import { classifyAutomation } from '../supabase/functions/track-affiliate-click/classify';
test('Technical retries share access ID; separate documents count separate accesses', async () => {
  const calls: string[] = [];
  let success = false;
  const capture = createAffiliateClickCapture(async entry => { calls.push(entry.access_id); return success; }, () => 'entry-1');
  await Promise.all([capture('DNGG5A4D'), capture('DNGG5A4D')]);
  success = true;
  await capture('DNGG5A4D');
  await capture('DNGG5A4D');
  expect(calls).toEqual(['entry-1', 'entry-1']);
  await createAffiliateClickCapture(async entry => { calls.push(entry.access_id); return true; }, () => 'entry-2')('DNGG5A4D');
  expect(calls).toEqual(['entry-1', 'entry-1', 'entry-2']);
});
test('Automation is classified separately on the server', () => {
  expect(classifyAutomation('Mozilla Chrome', 1)).toBeNull();
  expect(classifyAutomation('HeadlessChrome', 1)).toBe('automated_user_agent');
  expect(classifyAutomation('Mozilla Chrome', 301)).toBe('high_frequency');
});
test('In-app browsers count as people; explicit automation is flagged', () => {
  expect(classifyAutomation('Mozilla/5.0 (Linux; Android 14) WhatsApp/2.24 Mobile', 1)).toBeNull();
  expect(classifyAutomation('Mozilla/5.0 (iPhone) Instagram 300.0 FBAN/FBIOS', 1)).toBeNull();
  expect(classifyAutomation('Mozilla/5.0 HeadlessChrome/120', 1)).toBe('automated_user_agent');
  expect(classifyAutomation('Mozilla/5.0 Chrome/120', 301)).toBe('high_frequency');
});
