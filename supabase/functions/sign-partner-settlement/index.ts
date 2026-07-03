// Fase 1 - Etapa 3: consome atomicamente o settlement_quote via RPC transacional,
// captura IP/UA server-side, registra o aceite imutável, cria (ou vincula) o
// partner_early_terminations correspondente e devolve o recibo final.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const DECLARATION_TEXT =
  'Declaro que li e estou ciente dos valores finais, descontos, multa, modalidade de liquidação escolhida e condições do encerramento.'

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

    const supaAuth = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims } = await supaAuth.auth.getClaims(token)
    if (!claims?.claims) return corsResp({ error: 'Unauthorized' }, 401)
    const userId = claims.claims.sub as string

    const body = await req.json().catch(() => ({}))
    const { settlement_quote_id, route } = body as { settlement_quote_id?: string; route?: string }
    if (!settlement_quote_id) return corsResp({ error: 'settlement_quote_id obrigatório' }, 400)

    // Captura server-side de IP/UA
    const xff = req.headers.get('x-forwarded-for') || ''
    const ip = xff.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || ''
    const ua = req.headers.get('user-agent') || ''
    const { browser, os, device } = parseUA(ua)

    // RPC autenticada (SECURITY DEFINER) que consome o quote + insere aceite atomicamente
    const rpcClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: rpcResult, error: rpcErr } = await rpcClient.rpc(
      'finalize_partner_settlement_acceptance',
      {
        p_quote_id: settlement_quote_id,
        p_ip: ip,
        p_user_agent: ua,
        p_browser: browser,
        p_os: os,
        p_device: device,
        p_route: route ?? null,
        p_declaration_text: DECLARATION_TEXT,
      },
    )
    if (rpcErr) return corsResp({ error: rpcErr.message }, 400)

    const acceptanceId = (rpcResult as any)?.acceptance_id as string
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Buscar dados do aceite recém-inserido
    const { data: acceptance, error: aErr } = await svc
      .from('settlement_acceptances')
      .select('*')
      .eq('id', acceptanceId)
      .single()
    if (aErr || !acceptance) return corsResp({ error: 'Falha ao ler aceite' }, 500)

    // Criar partner_early_terminations vinculado, se ainda não existe.
    // Se falhar, marca processing_status = TERMINATION_FAILED.
    let processingStatus: 'TERMINATION_PROCESSED' | 'TERMINATION_FAILED' = 'TERMINATION_PROCESSED'
    let terminationId: string | null = acceptance.termination_id ?? null
    let processingError: string | null = null

    if (!terminationId) {
      const { data: contract } = await svc
        .from('partner_contracts')
        .select('total_cap, total_received')
        .eq('id', acceptance.partner_contract_id)
        .maybeSingle()

      const remainingCap = Math.max(
        0,
        Number(contract?.total_cap || 0) - Number(contract?.total_received || 0),
      )

      const { data: term, error: tErr } = await svc
        .from('partner_early_terminations')
        .insert({
          partner_contract_id: acceptance.partner_contract_id,
          liquidation_type: acceptance.liquidation_type,
          aporte_original: acceptance.gross_amount,
          total_received: acceptance.discounts,
          remaining_cap: remainingCap,
          discount_percentage: acceptance.gross_amount > 0
            ? Math.round((Number(acceptance.penalty) / Number(acceptance.gross_amount)) * 100)
            : 0,
          proposed_value: acceptance.net_amount,
          credits_amount: acceptance.liquidation_type === 'CREDITS' ? acceptance.net_amount : null,
          bids_amount: acceptance.liquidation_type === 'BIDS'
            ? Math.floor(Number(acceptance.net_amount) / 0.5)
            : null,
          status: 'PENDING',
        })
        .select('id')
        .single()

      if (tErr) {
        processingStatus = 'TERMINATION_FAILED'
        processingError = tErr.message
      } else {
        terminationId = term.id
      }
    }

    // Atualizar processing_status + termination_id no aceite (service_role bypassa trigger)
    await svc
      .from('settlement_acceptances')
      .update({ processing_status: processingStatus, termination_id: terminationId })
      .eq('id', acceptanceId)

    // Gerar recibo final com IP/UA/hora reais
    const receiptHtml = `<div style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;">
      <h1 style="margin:0 0 4px;font-size:22px;">Recibo de Encerramento Antecipado</h1>
      <p style="color:#666;margin:0 0 16px;">Show de Lances — assinatura eletrônica</p>
      <pre style="background:#f7f7f8;padding:16px;border-radius:8px;white-space:pre-wrap;font-size:12px;">${
        acceptance.terms_text.replace(/[<>&]/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
      }</pre>
      <hr style="margin:16px 0;border:none;border-top:1px solid #ddd;" />
      <p><strong>ID do aceite:</strong> ${acceptanceId}</p>
      <p><strong>Hash do termo (SHA-256):</strong> <span style="font-family:monospace;font-size:11px;">${acceptance.terms_hash}</span></p>
      <p><strong>Assinado em:</strong> ${new Date(acceptance.accepted_at).toLocaleString('pt-BR')}</p>
      <p><strong>IP:</strong> ${acceptance.ip_address || '—'}</p>
      <p><strong>User agent:</strong> <span style="font-family:monospace;font-size:11px;">${acceptance.user_agent || '—'}</span></p>
      <p><strong>Dispositivo/OS/Navegador:</strong> ${acceptance.device || '—'} / ${acceptance.os || '—'} / ${acceptance.browser || '—'}</p>
      <p><strong>Status do processamento:</strong> ${processingStatus}${processingError ? ` (${processingError})` : ''}</p>
    </div>`

    await svc.from('settlement_acceptances').update({ receipt_html: receiptHtml }).eq('id', acceptanceId)

    return corsResp({
      acceptance_id: acceptanceId,
      termination_id: terminationId,
      terms_hash: acceptance.terms_hash,
      receipt_html: receiptHtml,
      processing_status: processingStatus,
      processing_error: processingError,
    })
  } catch (e) {
    console.error('[sign-partner-settlement] error:', e)
    return corsResp({ error: (e as Error).message || 'Erro interno' }, 500)
  }
})
