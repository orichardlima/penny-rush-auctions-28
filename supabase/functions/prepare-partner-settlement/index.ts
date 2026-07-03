// Fase 1 - Etapa 1 do fluxo de encerramento com assinatura eletrônica.
// Recalcula server-side aporte/descontos/multa/líquido, monta o termo canônico,
// gera hash SHA-256 e emite settlement_quote com expiração de 10 minutos.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const DISCOUNT_PCT = 30 // deságio padrão sobre o aporte (mesma regra do dashboard)
const QUOTE_TTL_MIN = 10

function corsResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
}

function liquidationLabel(t: string): string {
  switch (t) {
    case 'PARTIAL_REFUND': return 'Estorno via PIX (reembolso parcial)'
    case 'CREDITS': return 'Conversão em créditos na plataforma'
    case 'BIDS': return 'Conversão em lances'
    default: return t
  }
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
    const { data: claimsData, error: claimsErr } = await supaAuth.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) return corsResp({ error: 'Unauthorized' }, 401)
    const userId = claimsData.claims.sub as string

    const body = await req.json().catch(() => ({}))
    const { partner_contract_id, liquidation_type } = body as {
      partner_contract_id?: string
      liquidation_type?: string
    }

    if (!partner_contract_id || typeof partner_contract_id !== 'string') {
      return corsResp({ error: 'partner_contract_id obrigatório' }, 400)
    }
    if (!['PARTIAL_REFUND', 'CREDITS', 'BIDS'].includes(liquidation_type ?? '')) {
      return corsResp({ error: 'liquidation_type inválido' }, 400)
    }

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 1. Ownership do contrato
    const { data: contract, error: cErr } = await svc
      .from('partner_contracts')
      .select('id, user_id, plan_name, aporte_value, total_cap, total_received, status')
      .eq('id', partner_contract_id)
      .maybeSingle()
    if (cErr) return corsResp({ error: cErr.message }, 500)
    if (!contract || contract.user_id !== userId) return corsResp({ error: 'Contrato não encontrado' }, 404)
    if (contract.status === 'CLOSED') return corsResp({ error: 'Contrato já encerrado' }, 400)

    // 2. Recalcular server-side (mesma lógica do EncerramentoDashboard)
    const aporte = Number(contract.aporte_value || 0)
    const totalCap = Number(contract.total_cap || 0)

    const { data: withdrawals } = await svc
      .from('partner_withdrawals')
      .select('amount, status')
      .eq('partner_contract_id', partner_contract_id)
    const totalWithdrawnPix = (withdrawals || [])
      .filter((w: any) => w.status === 'PAID')
      .reduce((s: number, w: any) => s + Number(w.amount || 0), 0)

    const { data: payouts } = await svc
      .from('partner_payouts')
      .select('amount, status')
      .eq('partner_contract_id', partner_contract_id)
    const totalCreditedPaid = (payouts || [])
      .filter((p: any) => p.status === 'PAID')
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const creditedNotWithdrawn = Math.max(0, totalCreditedPaid - totalWithdrawnPix)

    const penalty = aporte * (DISCOUNT_PCT / 100)
    const aporteAfterDiscount = aporte - penalty
    const netAmount = Math.max(0, aporteAfterDiscount - totalWithdrawnPix)
    const remainingCap = Math.max(0, totalCap - totalWithdrawnPix)

    // 3. terms_version = versão vigente do contrato de parceiro
    const { data: verSetting } = await svc
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'current_partner_contract_version')
      .maybeSingle()
    const termsVersion = verSetting?.setting_value ?? 'v1'

    // 4. Montar terms_text canônico (server-side, autoritativo)
    const nowIso = new Date().toISOString()
    const termsText = [
      `TERMO DE ENCERRAMENTO ANTECIPADO — SHOW DE LANCES`,
      `Versão do contrato de parceria vigente: ${termsVersion}`,
      `Data/hora da geração desta cotação: ${nowIso}`,
      ``,
      `Contrato de parceria: ${contract.plan_name} (ID ${contract.id})`,
      `Modalidade de liquidação escolhida: ${liquidationLabel(liquidation_type!)}`,
      ``,
      `1. VALORES CALCULADOS PELO SISTEMA (fonte de verdade: banco de dados)`,
      `   Aporte original: ${fmtBRL(aporte)}`,
      `   Teto total do contrato: ${fmtBRL(totalCap)}`,
      `   Saldo restante de teto (a que o parceiro abre mão): ${fmtBRL(remainingCap)}`,
      `   Deságio contratual sobre o aporte: ${DISCOUNT_PCT}%`,
      `   Valor da multa/deságio: ${fmtBRL(penalty)}`,
      `   Aporte após deságio: ${fmtBRL(aporteAfterDiscount)}`,
      `   Total já recebido via PIX (saques pagos): ${fmtBRL(totalWithdrawnPix)}`,
      `   Saldo creditado não sacado (não desconta): ${fmtBRL(creditedNotWithdrawn)}`,
      `   VALOR LÍQUIDO A RECEBER: ${fmtBRL(netAmount)}`,
      ``,
      `2. CARÁTER DA ASSINATURA`,
      `   Este documento é um recibo/declaração eletrônica de ciência do parceiro`,
      `   sobre os valores acima e a modalidade de liquidação escolhida.`,
      `   O encerramento antecipado é uma liquidação condicionada à liquidez da`,
      `   plataforma. Não representa devolução garantida do aporte.`,
      ``,
      `3. EVIDÊNCIAS TÉCNICAS`,
      `   No ato da assinatura eletrônica serão registrados data/hora, IP,`,
      `   user agent, dispositivo, navegador e demais evidências técnicas da sessão.`,
      ``,
      `4. DECLARAÇÃO`,
      `   Ao assinar eletronicamente, o parceiro declara ter lido e compreendido`,
      `   integralmente os valores finais, descontos, multa, modalidade de`,
      `   liquidação escolhida e condições do encerramento.`,
    ].join('\n')

    const termsHash = await sha256Hex(termsText)

    // 5. Renderizar receipt_preview_html (apenas para exibição inicial)
    const receiptPreviewHtml = `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap;font-size:12px;line-height:1.55;">${termsText.replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]!))}</pre>`

    // 6. Persistir settlement_quote
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MIN * 60_000).toISOString()
    const { data: quote, error: qErr } = await svc
      .from('settlement_quotes')
      .insert({
        user_id: userId,
        partner_contract_id,
        termination_id: null,
        liquidation_type,
        gross_amount: aporte,
        discounts: totalWithdrawnPix,
        penalty,
        net_amount: netAmount,
        terms_text: termsText,
        terms_hash: termsHash,
        terms_version: termsVersion,
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single()
    if (qErr) return corsResp({ error: qErr.message }, 500)

    return corsResp({
      settlement_quote_id: quote.id,
      gross_amount: aporte,
      discounts: totalWithdrawnPix,
      penalty,
      net_amount: netAmount,
      terms_text: termsText,
      terms_hash: termsHash,
      terms_version: termsVersion,
      receipt_preview_html: receiptPreviewHtml,
      expires_at: quote.expires_at,
    })
  } catch (e) {
    console.error('[prepare-partner-settlement] error:', e)
    return corsResp({ error: (e as Error).message || 'Erro interno' }, 500)
  }
})
