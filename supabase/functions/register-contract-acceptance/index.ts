// Registra aceite de contrato com captura server-side de IP/UA/browser/OS/device.
// Autenticação obrigatória via JWT (getClaims). Não confia em IP/UA/hash vindos do cliente.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

function corsResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseUA(ua: string) {
  const l = ua.toLowerCase()
  let browser = 'Outro'
  if (l.includes('edg/')) browser = 'Edge'
  else if (l.includes('chrome/')) browser = 'Chrome'
  else if (l.includes('firefox/')) browser = 'Firefox'
  else if (l.includes('safari/')) browser = 'Safari'
  let os = 'Outro'
  if (l.includes('windows')) os = 'Windows'
  else if (l.includes('android')) os = 'Android'
  else if (l.includes('iphone') || l.includes('ipad') || l.includes('ios')) os = 'iOS'
  else if (l.includes('mac os')) os = 'macOS'
  else if (l.includes('linux')) os = 'Linux'
  const device = /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop'
  return { browser, os, device }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return corsResp({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return corsResp({ error: 'Unauthorized' }, 401)

    const supa = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsRes, error: claimsErr } = await supa.auth.getClaims(token)
    if (claimsErr || !claimsRes?.claims) return corsResp({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const {
      contract_type,
      origin,
      declaration_text,
      partner_contract_id = null,
      plan_name = null,
      plan_value = null,
      route = null,
      payment_reference = null,
      extra = {},
    } = body as Record<string, any>

    if (contract_type !== 'partner' && contract_type !== 'bettor') {
      return corsResp({ error: 'contract_type inválido' }, 400)
    }
    if (typeof declaration_text !== 'string' || declaration_text.length < 5) {
      return corsResp({ error: 'declaration_text obrigatório' }, 400)
    }
    if (typeof origin !== 'string' || origin.length === 0) {
      return corsResp({ error: 'origin obrigatório' }, 400)
    }

    // Captura server-side de IP/UA — NUNCA aceitar do cliente.
    const xff = req.headers.get('x-forwarded-for') || ''
    const ip = xff.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || ''
    const ua = req.headers.get('user-agent') || ''
    const { browser, os, device } = parseUA(ua)

    // RPC autenticada (respeita RLS + resolve versão vigente + hash server-side).
    const { data, error } = await supa.rpc('register_contract_acceptance', {
      p_contract_type: contract_type,
      p_origin: origin,
      p_declaration_text: declaration_text,
      p_partner_contract_id: partner_contract_id,
      p_plan_name: plan_name,
      p_plan_value: plan_value,
      p_ip: ip || null,
      p_user_agent: ua || null,
      p_browser: browser,
      p_os: os,
      p_device: device,
      p_route: route,
      p_accepted_at_client: new Date().toISOString(),
      p_payment_reference: payment_reference,
      p_extra: { ...extra, captured_server_side: true },
    })
    if (error) return corsResp({ error: error.message }, 400)

    return corsResp({ ok: true, result: data })
  } catch (e) {
    console.error('[register-contract-acceptance] error:', e)
    return corsResp({ error: (e as Error).message || 'Erro interno' }, 500)
  }
})
