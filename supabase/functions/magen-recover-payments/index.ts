import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { confirmMagenCharge } from '../_shared/magen-confirm.ts'

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders});
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Configuration missing', {status:500,headers:corsHeaders});
  try {
    const body = await req.json();
    if (typeof body.ticket !== 'string' || !/^[0-9a-f-]{36}$/.test(body.ticket)) return new Response('Unauthorized',{status:401,headers:corsHeaders});
    const sb = createClient(url,key);
    const {data: authorized,error: ticketError} = await sb.rpc('magenpay_consume_recovery_ticket',{p_ticket:body.ticket});
    if (ticketError || authorized !== true) return new Response('Unauthorized',{status:401,headers:corsHeaders});
    const {data: charges,error} = await sb.rpc('magenpay_claim_pending');
    if (error) throw new Error('Queue unavailable');
    let completed = 0;
    await Promise.all((charges || []).map(async (charge: any) => {
      try {
        const result = await confirmMagenCharge(sb,charge);
        if (result.processed || result.already_processed) completed++;
        else await sb.from('magenpay_charges').update({lease_until:null,next_retry_at:new Date(Date.now()+5*60000).toISOString(),last_error:null}).eq('id',charge.id).eq('status','pending');
      } catch {
        await sb.from('magenpay_charges').update({lease_until:null,next_retry_at:new Date(Date.now()+5*60000).toISOString(),last_error:'Verification or atomic processing failed'}).eq('id',charge.id).eq('status','pending');
      }
    }));
    const {error: scheduleError} = await sb.rpc('magenpay_refresh_recovery');
    if (scheduleError) throw new Error('Retry scheduling failed');
    return new Response(JSON.stringify({checked:charges?.length || 0,completed}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  } catch {
    console.error('MagenPay recovery failed');
    return new Response('Recovery failed',{status:500,headers:corsHeaders});
  }
});