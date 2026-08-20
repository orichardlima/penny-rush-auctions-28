import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { createDeposit } from '../_shared/payment-router.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { debtId, userCpf, userName, userEmail, amount: rawAmount } = await req.json()
    if (!debtId || !userCpf) {
      return new Response(JSON.stringify({ error: 'debtId e userCpf são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: debt, error: debtError } = await supabase
      .from('partner_credit_debts')
      .select('id, user_id, amount, paid_amount, status, referred_email')
      .eq('id', debtId)
      .single()

    if (debtError || !debt) {
      return new Response(JSON.stringify({ error: 'Dívida não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (debt.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Esta dívida não pertence a você' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (debt.status === 'PAID' || debt.status === 'WRITTEN_OFF') {
      return new Response(JSON.stringify({ error: 'Esta dívida já foi quitada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const remaining = Math.max(0, Number(debt.amount) - Number(debt.paid_amount || 0))
    if (remaining <= 0) {
      return new Response(JSON.stringify({ error: 'Esta dívida já foi quitada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let payAmount = remaining
    if (rawAmount !== undefined && rawAmount !== null && rawAmount !== '') {
      const parsed = Number(rawAmount)
      if (isNaN(parsed) || parsed <= 0) {
        return new Response(JSON.stringify({ error: 'Valor inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (parsed > remaining + 0.009) {
        return new Response(JSON.stringify({ error: `Valor acima do saldo devedor (R$ ${remaining.toFixed(2)})` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      payAmount = Math.round(parsed * 100) / 100
    }

    const isPartial = (remaining - payAmount) > 0.009
    const externalId = isPartial
      ? `credit:${debt.id}:${Math.round(payAmount * 100)}`
      : `credit:${debt.id}`

    const depositResult = await createDeposit(supabase, {
      amount: payAmount,
      externalId,
      description: `Devolução ${isPartial ? 'parcial ' : ''}de crédito de confiança${debt.referred_email ? ` - ${debt.referred_email}` : ''}`,
      payerName: userName || 'Usuario',
      payerEmail: userEmail || '',
      payerDocument: userCpf
    })

    return new Response(JSON.stringify({
      paymentId: depositResult.transactionId,
      qrCodeBase64: depositResult.qrCodeBase64,
      pixCopyPaste: depositResult.pixCopyPaste || null,
      amount: payAmount,
      remaining,
      partial: isPartial,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })


  } catch (error: any) {
    console.error('❌ partner-credit-repay error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno do servidor', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
