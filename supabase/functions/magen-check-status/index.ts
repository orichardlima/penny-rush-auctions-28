import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { confirmMagenCharge } from '../_shared/magen-confirm.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {...corsHeaders, 'Content-Type': 'application/json'}})
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: corsHeaders})
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || !service) return json({error:'Configuration missing'},500)
  try {
    const authorization = req.headers.get('Authorization') || ''
    const client = createClient(url,key)
    const {data: auth, error: authError} = await client.auth.getUser(authorization.replace(/^Bearer /,''))
    if (authError || !auth.user) return json({error:'Unauthorized'},401)
    const body = await req.json()
    if (typeof body.txId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(body.txId)) return json({error:'Invalid txId'},400)
    const sb = createClient(url,service)
    const {data: charge, error} = await sb.from('magenpay_charges').select('*').eq('tx_id',body.txId).eq('user_id',auth.user.id).maybeSingle()
    if (error) return json({error:'Charge lookup failed'},500)
    if (!charge) return json({status:'pending',processed:false,message:'PIX não vinculado ao MagenPay'},200)
    if ((body.chargeId && body.chargeId !== charge.id) || (body.upgradeRef && body.upgradeRef !== charge.external_reference) || (body.purchaseId && body.purchaseId !== charge.snapshot.entity_id) || (body.intentId && body.intentId !== charge.snapshot.entity_id)) return json({error:'Payment reference mismatch'},400)
    const result = await confirmMagenCharge(sb,charge)
    return json(result)
  } catch {
    // Do not log provider payloads, bearer tokens or personal data.
    console.error('MagenPay status verification failed')
    return json({status:'error',processed:false,error:'Não foi possível confirmar o PIX com segurança'},502)
  }
})
