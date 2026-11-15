// Verified against the hosted Auth redirect allowlist. Do not trust request Origin.
const impersonationOrigin = 'https://penny-rush-auctions-28.lovable.app';

export function getImpersonationRedirect(logId: string): string {
  const url = new URL('/dashboard', impersonationOrigin);
  url.searchParams.set('impersonating', logId);
  return url.toString();
}