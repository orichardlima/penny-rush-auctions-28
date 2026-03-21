import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PARTNER PAYMENT WEBHOOK START (ASAAS) ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 Webhook payload:', JSON.stringify(body))

    const event = body.event
    const payment = body.payment

    if (!payment) {
      console.log('ℹ️ No payment data, ignoring')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const paymentId = payment.id
    const externalReference = payment.externalReference || ''
    const status = payment.status

    console.log('💳 Event:', event, 'Payment:', paymentId, 'Status:', status, 'Ref:', externalReference)

    const isApproved = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || status === 'RECEIVED' || status === 'CONFIRMED'
    const isRejected = event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED' || status === 'OVERDUE' || status === 'REFUNDED'

    if (!isApproved && !isRejected) {
      console.log('ℹ️ Event not actionable:', event)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Verificar se é UPGRADE
    if (externalReference.startsWith('upgrade:')) {
      console.log('🔄 Processing UPGRADE payment')
      return await processUpgradePayment(supabase, isApproved, isRejected, externalReference, paymentId)
    }

    // Caso contrário, é NOVO CONTRATO via payment intent
    console.log('🆕 Processing NEW CONTRACT payment via intent')
    return await processNewContractPayment(supabase, isApproved, isRejected, paymentId, externalReference)

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

async function processNewContractPayment(supabase: any, isApproved: boolean, isRejected: boolean, paymentId: string, externalReference: string) {
  // Buscar intent pelo payment_id ou externalReference
  let intent = null

  const { data: intentByPayment } = await supabase
    .from('partner_payment_intents')
    .select('*')
    .eq('payment_id', paymentId)
    .single()

  if (intentByPayment) {
    intent = intentByPayment
  } else if (externalReference) {
    const { data: intentByRef } = await supabase
      .from('partner_payment_intents')
      .select('*')
      .eq('id', externalReference)
      .single()
    intent = intentByRef
  }

  if (!intent) {
    // Fallback: legacy contract lookup
    console.log('ℹ️ Intent not found, trying legacy contract lookup...')
    return await processLegacyContractPayment(supabase, isApproved, isRejected, paymentId)
  }

  console.log('📄 Intent found:', intent.id, 'status:', intent.payment_status)

  if (isApproved && intent.payment_status !== 'approved') {
    console.log('✅ Payment approved, creating real contract')

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

    const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase()

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
        payment_id: paymentId,
        referred_by_user_id: intent.referred_by_user_id,
        referral_code: newReferralCode,
        bonus_bids_received: intent.bonus_bids || 0
      })
      .select()
      .single()

    if (contractError) {
      console.error('❌ Failed to create contract:', contractError)
      return new Response('Contract creation failed', { status: 500, headers: corsHeaders })
    }

    console.log('✅ Contract created (ACTIVE):', contractData.id)
    // Lances bônus são creditados automaticamente pelo trigger trg_credit_bonus_bids_on_contract

    await supabase
      .from('partner_payment_intents')
      .update({ payment_status: 'approved' })
      .eq('id', intent.id)

    console.log('✅ Partner contract activation completed')

  } else if (isRejected) {
    console.log('❌ Payment rejected, updating intent')
    await supabase
      .from('partner_payment_intents')
      .update({ payment_status: 'expired' })
      .eq('id', intent.id)
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

async function processLegacyContractPayment(supabase: any, isApproved: boolean, isRejected: boolean, paymentId: string) {
  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('payment_id', paymentId)
    .single()

  if (!contract) {
    console.log('ℹ️ Payment not related to partner contracts, ignoring:', paymentId)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  if (isApproved && contract.payment_status !== 'completed') {
    const { data: planData } = await supabase
      .from('partner_plans')
      .select('bonus_bids')
      .eq('name', contract.plan_name)
      .maybeSingle()

    await supabase
      .from('partner_contracts')
      .update({ status: 'ACTIVE', payment_status: 'completed', bonus_bids_received: planData?.bonus_bids || 0 })
      .eq('id', contract.id)
    // Nota: para contratos legacy, o trigger só atua no INSERT. O crédito de bônus em UPDATE precisa ser manual ou via nova lógica.
  } else if (isRejected) {
    await supabase
      .from('partner_contracts')
      .update({ status: 'SUSPENDED', payment_status: 'failed' })
      .eq('id', contract.id)
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

async function processUpgradePayment(supabase: any, isApproved: boolean, isRejected: boolean, externalReference: string, paymentId: string) {
  const parts = externalReference.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid upgrade reference:', externalReference)
    return new Response('Invalid reference', { status: 400, headers: corsHeaders })
  }

  const contractId = parts[1]
  const newPlanId = parts[2]

  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return new Response('Contract not found', { status: 404, headers: corsHeaders })
  }

  const { data: newPlan } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('id', newPlanId)
    .single()

  if (!newPlan) {
    return new Response('Plan not found', { status: 404, headers: corsHeaders })
  }

  if (isApproved) {
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
      notes: `Pagamento Asaas ID: ${paymentId}`
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
  } else if (isRejected) {
    console.log('❌ Upgrade payment rejected')
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}
