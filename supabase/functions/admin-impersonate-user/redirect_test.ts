import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getImpersonationRedirect } from './redirect.ts';

Deno.test('Admin partner login uses the verified public return URL', () => {
  assertEquals(
    getImpersonationRedirect('audit-123'),
    'https://penny-rush-auctions-28.lovable.app/dashboard?impersonating=audit-123',
  );
});

Deno.test('Audit identifier cannot change the return destination', () => {
  const url = new URL(getImpersonationRedirect('abc&redirect_to=https://example.com'));
  assertEquals(url.origin, 'https://penny-rush-auctions-28.lovable.app');
  assertEquals(url.searchParams.get('impersonating'), 'abc&redirect_to=https://example.com');
  assertEquals(url.searchParams.has('redirect_to'), false);
});