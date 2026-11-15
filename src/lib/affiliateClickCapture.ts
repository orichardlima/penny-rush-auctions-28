type Entry = { code: string; access_id: string };
type Send = (entry: Entry) => Promise<boolean>;
// One instance per document: React remounts/retries share the access ID,
// while a reload or a new document creates a genuinely new access.
export function createAffiliateClickCapture(send: Send, makeId = () => crypto.randomUUID()) {
  let entry: Entry | null = null;
  let recorded = false;
  let pending: Promise<void> | null = null;
  return (code: string): Promise<void> => {
    if (!entry) entry = { code, access_id: makeId() };
    if (recorded) return Promise.resolve();
    if (pending) return pending;
    const current = entry;
    pending = send(current).then(ok => { recorded = ok; }).catch(() => {}).finally(() => { pending = null; });
    return pending;
  };
}