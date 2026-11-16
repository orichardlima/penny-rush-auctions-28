type Entry = { code: string; access_id: string; visitor_id?: string };
type Send = (entry: Entry) => Promise<boolean>;
// One instance per document: React remounts/retries share the access ID,
// while a reload or a new document creates a genuinely new access.
export function createAffiliateClickCapture(send: Send, makeId = () => crypto.randomUUID(), getVisitor: () => string | undefined = () => undefined) {
  let entry: Entry | null = null;
  let recorded = false;
  let pending: Promise<void> | null = null;
  return (code: string): Promise<void> => {
    if (!entry) entry = { code, access_id: makeId(), visitor_id: getVisitor() };
    if (recorded) return Promise.resolve();
    if (pending) return pending;
    const current = entry;
    pending = send(current).then(ok => { recorded = ok; }).catch(() => {}).finally(() => { pending = null; });
    return pending;
  };
}
const VISITOR_KEY = 'aff_visitor_id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Persistent first-party visitor ID (localStorage + 1-year cookie) so the same
// browser counts as one person across reloads and browser restarts.
export function getAffiliateVisitorId(): string | undefined {
  try {
    const fromCookie = document.cookie.split(';').map(c => c.trim().split('=')).find(([k]) => k === VISITOR_KEY)?.[1];
    let id = localStorage.getItem(VISITOR_KEY) ?? fromCookie ?? '';
    if (!UUID.test(id)) id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    document.cookie = `${VISITOR_KEY}=${id}; max-age=31536000; path=/; SameSite=Lax`;
    return id;
  } catch { return undefined; }
}
