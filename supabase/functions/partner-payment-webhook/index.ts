import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PARTNER PAYMENT WEBHOOK START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 Webhook payload:', body)

    if (body.type !== 'payment') {
      console.log('ℹ️ Not a payment notification, ignoring')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      console.log('❌ No payment ID in webhook')
      return new Response('No payment ID', { status: 400, headers: corsHeaders })
    }

    console.log('💳 Processing payment ID:', paymentId)

    // 1. Buscar dados do pagamento no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mercadoPagoAccessToken}` }
    })

    if (!mpResponse.ok) {
      console.error('❌ Failed to fetch payment from Mercado Pago')
      return new Response('Payment fetch failed', { status: 400, headers: corsHeaders })
    }

    const paymentData = await mpResponse.json()
    console.log('📦 Payment data:', {
      id: paymentData.id,
      status: paymentData.status,
      external_reference: paymentData.external_reference
    })

    const externalReference = paymentData.external_reference || ''

    // 2. Verificar se é um pagamento de UPGRADE
    if (externalReference.startsWith('upgrade:')) {
      console.log('🔄 Processing UPGRADE payment')
      return await processUpgradePayment(supabase, paymentData, externalReference)
    }

    // 3. Caso contrário, é pagamento de NOVO CONTRATO (via payment intent)
    console.log('🆕 Processing NEW CONTRACT payment via intent')
    return await processNewContractPayment(supabase, paymentData, paymentId)

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

// Processar pagamento de NOVO CONTRATO (agora via payment_intents)
async function processNewContractPayment(supabase: any, paymentData: any, paymentId: string) {
  // Buscar payment intent pelo payment_id
  const { data: intent, error: intentError } = await supabase
    .from('partner_payment_intents')
    .select('*')
    .eq('payment_id', paymentId.toString())
    .single()

  if (intentError || !intent) {
    // Fallback: tentar buscar contrato antigo (compatibilidade com contratos PENDING pré-existentes)
    console.log('ℹ️ Intent not found, trying legacy contract lookup...')
    return await processLegacyContractPayment(supabase, paymentData, paymentId)
  }

  console.log('📄 Intent found:', intent.id, 'status:', intent.payment_status)

  if (paymentData.status === 'approved' && intent.payment_status !== 'approved') {
    console.log('✅ Payment approved, creating real contract')

    // 1. Verificar se já não existe contrato ACTIVE para este usuário (segurança)
    const { data: existingActive } = await supabase
      .from('partner_contracts')
      .select('id')
      .eq('user_id', intent.user_id)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (existingActive) {
      console.log('⚠️ User already has active contract, skipping creation')
      await supabase
        .from('partner_payment_intents')
        .update({ payment_status: 'approved' })
        .eq('id', intent.id)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // 2. Gerar código de indicação único
    const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase()

    // 3. Criar contrato REAL com status ACTIVE
    const { data: contractData, error: contractError } = await supabase
      .from('partner_contracts')
      .insert({
        user_id: intent.user_id,
        plan_name: intent.plan_name,
        aporte_value: intent.aporte_value,
        weekly_cap: intent.weekly_cap,
        total_cap: intent.total_cap,
        status: 'ACTIVE',
        payment_status: 'completed',
        payment_id: paymentId.toString(),
        referred_by_user_id: intent.referred_by_user_id,
        referral_code: newReferralCode
      })
      .select()
      .single()

    if (contractError) {
      console.error('❌ Failed to create contract:', contractError)
      return new Response('Contract creation failed', { status: 500, headers: corsHeaders })
    }

    console.log('✅ Contract created (ACTIVE):', contractData.id, 'referral_code:', newReferralCode)

    // 4. Creditar bônus de lances
    const bonusBids = intent.bonus_bids || 0
    if (bonusBids > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('bids_balance')
        .eq('user_id', intent.user_id)
        .single()

      if (profile) {
        const newBalance = (profile.bids_balance || 0) + bonusBids
        await supabase
          .from('profiles')
          .update({ bids_balance: newBalance })
          .eq('user_id', intent.user_id)

        await supabase
          .from('partner_contracts')
          .update({ bonus_bids_received: bonusBids })
          .eq('id', contractData.id)

        console.log('✅ Bonus bids credited:', bonusBids)
      }
    }

    // 5. Atualizar intent como aprovado
    await supabase
      .from('partner_payment_intents')
      .update({ payment_status: 'approved' })
      .eq('id', intent.id)

    // 6. Bônus de indicação em cascata é criado pelo trigger
    console.log('ℹ️ Cascade referral bonuses will be created by database trigger')
    console.log('✅ Partner contract activation completed successfully')

  } else if (paymentData.status === 'cancelled' || paymentData.status === 'rejected') {
    console.log('❌ Payment cancelled/rejected, updating intent')
    await supabase
      .from('partner_payment_intents')
      .update({ payment_status: paymentData.status === 'cancelled' ? 'expired' : 'rejected' })
      .eq('id', intent.id)

  } else if (paymentData.status === 'pending') {
    console.log('ℹ️ Payment still pending, no action needed')
  }

  console.log('=== PARTNER PAYMENT WEBHOOK END ===')
  return new Response('OK', { status: 200, headers: corsHeaders })
}

// Compatibilidade: processar contratos PENDING criados antes da migração
async function processLegacyContractPayment(supabase: any, paymentData: any, paymentId: string) {
  const { data: contract, error: contractError } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('payment_id', paymentId.toString())
    .single()

  if (contractError || !contract) {
    console.error('❌ Neither intent nor legacy contract found for payment:', paymentId)
    return new Response('Not found', { status: 404, headers: corsHeaders })
  }

  console.log('📄 Legacy contract found:', contract.id, 'status:', contract.status)

  if (paymentData.status === 'approved' && contract.payment_status !== 'completed') {
    console.log('✅ Legacy payment approved, activating contract')

    const { data: planData } = await supabase
      .from('partner_plans')
      .select('bonus_bids')
      .eq('name', contract.plan_name)
      .maybeSingle()

    await supabase
      .from('partner_contracts')
      .update({ status: 'ACTIVE', payment_status: 'completed' })
      .eq('id', contract.id)

    const bonusBids = planData?.bonus_bids || 0
    if (bonusBids > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('bids_balance')
        .eq('user_id', contract.user_id)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({ bids_balance: (profile.bids_balance || 0) + bonusBids })
          .eq('user_id', contract.user_id)

        await supabase
          .from('partner_contracts')
          .update({ bonus_bids_received: bonusBids })
          .eq('id', contract.id)
      }
    }

    console.log('✅ Legacy contract activated')
  } else if (paymentData.status === 'cancelled' || paymentData.status === 'rejected') {
    await supabase
      .from('partner_contracts')
      .update({ status: 'SUSPENDED', payment_status: 'failed' })
      .eq('id', contract.id)
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// Processar pagamento de UPGRADE (sem alteração)
async function processUpgradePayment(supabase: any, paymentData: any, externalReference: string) {
  const parts = externalReference.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid upgrade external_reference format:', externalReference)
    return new Response('Invalid reference', { status: 400, headers: corsHeaders })
  }

  const contractId = parts[1]
  const newPlanId = parts[2]

  console.log('📄 Upgrade details - Contract:', contractId, 'New Plan:', newPlanId)

  const { data: contract, error: contractError } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (contractError || !contract) {
    console.error('❌ Contract not found for upgrade:', contractError)
    return new Response('Contract not found', { status: 404, headers: corsHeaders })
  }

  const { data: newPlan, error: planError } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('id', newPlanId)
    .single()

  if (planError || !newPlan) {
    console.error('❌ New plan not found for upgrade:', planError)
    return new Response('Plan not found', { status: 404, headers: corsHeaders })
  }

  if (paymentData.status === 'approved') {
    console.log('✅ Upgrade payment approved, applying upgrade')

    const differencePaid = newPlan.aporte_value - contract.aporte_value

    await supabase.from('partner_upgrades').insert({
      partner_contract_id: contract.id,
      previous_plan_name: contract.plan_name,
      previous_aporte_value: contract.aporte_value,
      previous_weekly_cap: contract.weekly_cap,
      previous_total_cap: contract.total_cap,
      new_plan_name: newPlan.name,
      new_aporte_value: newPlan.aporte_value,
      new_weekly_cap: newPlan.weekly_cap,
      new_total_cap: newPlan.total_cap,
      total_received_at_upgrade: contract.total_received,
      difference_paid: differencePaid,
      notes: `Pagamento PIX ID: ${paymentData.id}`
    })

    await supabase
      .from('partner_contracts')
      .update({
        plan_name: newPlan.name,
        aporte_value: newPlan.aporte_value,
        weekly_cap: newPlan.weekly_cap,
        total_cap: newPlan.total_cap,
        updated_at: new Date().toISOString()
      })
      .eq('id', contract.id)

    console.log('✅ Contract upgraded:', contract.plan_name, '→', newPlan.name)
  } else if (paymentData.status === 'cancelled' || paymentData.status === 'rejected') {
    console.log('❌ Upgrade payment cancelled/rejected')
  } else if (paymentData.status === 'pending') {
    console.log('ℹ️ Upgrade payment still pending')
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}