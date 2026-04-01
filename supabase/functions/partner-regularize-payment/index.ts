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
    console.log('=== PARTNER REGULARIZE PAYMENT START ===')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { contractId, userId, userEmail, userName, userCpf } = await req.json()

    if (!contractId || !userId || !userCpf) {
      return new Response(
        JSON.stringify({ error: 'contractId, userId e userCpf são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate contract
    const { data: contract, error: contractError } = await supabase
      .from('partner_contracts')
      .select('id, user_id, status, financial_status, aporte_value, plan_name')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (contract.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Contrato não pertence a este usuário' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (contract.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: 'Contrato não está ativo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (contract.financial_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Contrato já está regularizado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📦 Generating regularization payment for contract:', contractId, 'amount:', contract.aporte_value)

    const externalId = `regularize:${contractId}`

    const depositResult = await createDeposit(supabase, {
      amount: contract.aporte_value,
      externalId,
      description: `Regularização Parceria ${contract.plan_name}`,
      payerName: userName || 'Usuario',
      payerEmail: userEmail || '',
      payerDocument: userCpf
    })

    console.log('✅ Regularization deposit created:', depositResult.transactionId)

    return new Response(
      JSON.stringify({
        paymentId: depositResult.transactionId,
        qrCodeBase64: depositResult.qrCodeBase64,
        pixCopyPaste: depositResult.pixCopyPaste || null,
        amount: contract.aporte_value,
        planName: contract.plan_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Regularize payment error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
