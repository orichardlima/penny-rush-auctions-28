import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { classifyAutomation } from './classify.ts';

const buckets = new Map<string, { count: number; until: number }>();
Deno.serve(async (req) => {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers, status });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return respond({ error: 'method' }, 405);
  try {
    const text = await req.text();
    if (text.length > 1024) return respond({ error: 'payload' }, 413);
    const body = JSON.parse(text);
    if (typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{3,64}$/.test(body.code) || typeof body.access_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.access_id)) return respond({ error: 'invalid' }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const now = Date.now();
    for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
    const bucket = buckets.get(ip) ?? { count: 0, until: now + 60000 };
    bucket.count += 1;
    buckets.set(ip, bucket);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const visitorId = typeof body.visitor_id === 'string' && uuidRe.test(body.visitor_id) ? body.visitor_id : null;
    const reason = classifyAutomation(req.headers.get('user-agent') ?? '', bucket.count);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return respond({ error: 'unavailable' }, 503);
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.rpc('record_affiliate_click_v2', { p_code: body.code, p_access_id: body.access_id, p_visitor_id: visitorId, p_is_automated: reason !== null, p_reason: reason });
    if (error) { console.error('affiliate click persistence failed', error.code); return respond({ error: 'retry' }, 503); }
    return respond({ recorded: data === true });
  } catch { return respond({ error: 'invalid' }, 400); }
});