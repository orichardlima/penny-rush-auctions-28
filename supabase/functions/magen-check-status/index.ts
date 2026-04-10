import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const VPS_MAGEN_RAW = Deno.env.get('VPS_MAGEN_URL') || 'http://76.13.162.10:3333'
const VPS_BASE_URL = VPS_MAGEN_RAW.replace(/\/(pix|pagamento).*$/, '').replace(/\/$/, '')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { txId, purchaseId, intentId, upgradeRef } = await req.json()

    if (!txId) {
      return new Response(
        JSON.stringify({ error: 'txId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Must have at least one target
    if (!purchaseId && !intentId && !upgradeRef) {
      return new Response(
        JSON.stringify({ error: 'purchaseId, intentId, or upgradeRef is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Checking MagenPay status for txId: ${txId}, purchaseId: ${purchaseId || '-'}, intentId: ${intentId || '-'}, upgradeRef: ${upgradeRef || '-'}`)

    // Query VPS for payment status
    const statusUrl = `${VPS_BASE_URL}/pix/status/${txId}`
    console.log(`📡 GET ${statusUrl}`)

    const vpsResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    const vpsData = await vpsResponse.json()
    console.log('📨 VPS response:', JSON.stringify(vpsData))

    if (!vpsData.sucesso) {
      return new Response(
        JSON.stringify({ status: 'pending', message: 'Aguardando pagamento' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pixStatus = vpsData.dados?.status?.toLowerCase()
    console.log(`💳 PIX status: ${pixStatus}`)

    if (pixStatus !== 'paid') {
      return new Response(
        JSON.stringify({ status: pixStatus || 'pending' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Payment is PAID — process it server-side
    console.log('✅ Payment confirmed as PAID, processing...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ===== ROUTE: Partner Intent (new contract) =====
    if (intentId) {
      return await processPartnerIntent(supabase, intentId, txId)
    }

    // ===== ROUTE: Upgrade or Cotas Upgrade =====
    if (upgradeRef) {
      return await processUpgradeRef(supabase, upgradeRef, txId)
    }

    // ===== ROUTE: Bid Purchase (existing logic) =====
    if (purchaseId) {
      return await processBidPurchase(supabase, purchaseId)
    }

    return new Response(
      JSON.stringify({ status: 'paid', processed: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ magen-check-status error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error', status: 'error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ===== PARTNER INTENT (new contract) =====
async function processPartnerIntent(supabase: any, intentId: string, txId: string) {
  const { data: intent, error: intentError } = await supabase
    .from('partner_payment_intents')
    .select('*')
    .eq('id', intentId)
    .single()

  if (intentError || !intent) {
    console.error('❌ Intent not found:', intentError)
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Intent not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Idempotency
  if (intent.payment_status === 'approved') {
    console.log('ℹ️ Intent already approved')
    return new Response(
      JSON.stringify({ status: 'paid', already_processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Check if user already has active contract
  const { data: existingActive } = await supabase
    .from('partner_contracts')
    .select('id')
    .eq('user_id', intent.user_id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (existingActive) {
    console.log('⚠️ User already has active contract, marking intent as approved')
    await supabase
      .from('partner_payment_intents')
      .update({ payment_status: 'approved' })
      .eq('id', intent.id)
    return new Response(
      JSON.stringify({ status: 'paid', already_processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Create contract
  const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase()

  const { data: contractData, error: contractError } = await supabase
    .from('partner_contracts')
    .insert({
      user_id: intent.user_id,
      plan_name: intent.plan_name,
      aporte_value: intent.aporte_value,
      weekly_cap: intent.weekly_cap,
      total_cap: intent.total_cap,
      cotas: intent.cotas || 1,
      status: 'ACTIVE',
      payment_status: 'completed',
      payment_id: txId,
      referred_by_user_id: intent.referred_by_user_id,
      referral_code: newReferralCode,
      bonus_bids_received: intent.bonus_bids || 0
    })
    .select()
    .single()

  if (contractError) {
    console.error('❌ Failed to create contract:', contractError)
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Contract creation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log('✅ Contract created (ACTIVE):', contractData.id)

  // Update intent
  await supabase
    .from('partner_payment_intents')
    .update({ payment_status: 'approved', payment_id: txId })
    .eq('id', intent.id)

  // Credit bonus bids if applicable
  if (intent.bonus_bids && intent.bonus_bids > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('bids_balance')
      .eq('user_id', intent.user_id)
      .single()

    if (profile) {
      const newBalance = (profile.bids_balance || 0) + intent.bonus_bids
      await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', intent.user_id)
      console.log(`✅ Credited ${intent.bonus_bids} bonus bids. New balance: ${newBalance}`)
    }
  }

  console.log('✅ Partner contract activation completed via check-status')

  return new Response(
    JSON.stringify({ status: 'paid', processed: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ===== UPGRADE / COTAS UPGRADE =====
async function processUpgradeRef(supabase: any, upgradeRef: string, txId: string) {
  if (upgradeRef.startsWith('cotas-upgrade:')) {
    return await processCotasUpgrade(supabase, upgradeRef, txId)
  }
  if (upgradeRef.startsWith('upgrade:')) {
    return await processPlanUpgrade(supabase, upgradeRef, txId)
  }

  console.error('❌ Unknown upgradeRef format:', upgradeRef)
  return new Response(
    JSON.stringify({ status: 'paid', error: 'Unknown upgrade format' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function processCotasUpgrade(supabase: any, upgradeRef: string, txId: string) {
  const parts = upgradeRef.split(':')
  if (parts.length !== 3) {
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Invalid cotas upgrade ref' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const contractId = parts[1]
  const newCotas = parseInt(parts[2], 10)

  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Contract not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Idempotency: already upgraded
  if (contract.cotas >= newCotas) {
    console.log('ℹ️ Cotas already upgraded')
    return new Response(
      JSON.stringify({ status: 'paid', already_processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: currentPlan } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('name', contract.plan_name)
    .eq('is_active', true)
    .single()

  if (!currentPlan) {
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Plan not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const cotasDiff = newCotas - contract.cotas
  const differencePaid = currentPlan.aporte_value * cotasDiff
  const newAporteValue = currentPlan.aporte_value * newCotas
  const newTotalCap = currentPlan.total_cap * newCotas
  const newWeeklyCap = currentPlan.weekly_cap * newCotas
  const newBonusBids = currentPlan.bonus_bids * newCotas

  await supabase.from('partner_upgrades').insert({
    partner_contract_id: contract.id,
    previous_plan_name: contract.plan_name,
    previous_aporte_value: contract.aporte_value,
    previous_weekly_cap: contract.weekly_cap,
    previous_total_cap: contract.total_cap,
    new_plan_name: contract.plan_name,
    new_aporte_value: newAporteValue,
    new_weekly_cap: newWeeklyCap,
    new_total_cap: newTotalCap,
    total_received_at_upgrade: contract.total_received,
    difference_paid: differencePaid,
    notes: `Upgrade de cotas: ${contract.cotas} → ${newCotas}. MagenPay TX: ${txId}`
  })

  await supabase
    .from('partner_contracts')
    .update({
      cotas: newCotas,
      aporte_value: newAporteValue,
      weekly_cap: newWeeklyCap,
      total_cap: newTotalCap,
      bonus_bids_received: newBonusBids,
      updated_at: new Date().toISOString()
    })
    .eq('id', contract.id)

  console.log('✅ Cotas upgraded via check-status:', contract.cotas, '→', newCotas)

  return new Response(
    JSON.stringify({ status: 'paid', processed: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function processPlanUpgrade(supabase: any, upgradeRef: string, txId: string) {
  const parts = upgradeRef.split(':')
  if (parts.length !== 3) {
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Invalid upgrade ref' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const contractId = parts[1]
  const newPlanId = parts[2]

  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Contract not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: newPlan } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('id', newPlanId)
    .single()

  if (!newPlan) {
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Plan not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Idempotency
  if (contract.plan_name === newPlan.name) {
    console.log('ℹ️ Plan already upgraded')
    return new Response(
      JSON.stringify({ status: 'paid', already_processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

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
    notes: `MagenPay TX: ${txId}`
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

  console.log('✅ Plan upgraded via check-status:', contract.plan_name, '→', newPlan.name)

  return new Response(
    JSON.stringify({ status: 'paid', processed: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ===== BID PURCHASE (existing logic) =====
async function processBidPurchase(supabase: any, purchaseId: string) {
  const { data: purchase, error: purchaseError } = await supabase
    .from('bid_purchases')
    .select('*')
    .eq('id', purchaseId)
    .single()

  if (purchaseError || !purchase) {
    console.error('❌ Purchase not found:', purchaseError)
    return new Response(
      JSON.stringify({ status: 'paid', error: 'Purchase not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Idempotency
  if (purchase.payment_status === 'completed') {
    console.log('ℹ️ Purchase already completed')
    return new Response(
      JSON.stringify({ status: 'paid', already_processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 1. Update bid_purchases status
  await supabase
    .from('bid_purchases')
    .update({ payment_status: 'completed' })
    .eq('id', purchase.id)

  console.log('✅ bid_purchases updated to completed')

  // 2. Credit bids to user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('bids_balance')
    .eq('user_id', purchase.user_id)
    .single()

  if (profile) {
    const newBalance = (profile.bids_balance || 0) + purchase.bids_purchased
    await supabase
      .from('profiles')
      .update({ bids_balance: newBalance })
      .eq('user_id', purchase.user_id)
    console.log(`✅ Credited ${purchase.bids_purchased} bids. New balance: ${newBalance}`)
  }

  // 3. Approve affiliate commissions
  const { data: commissions } = await supabase
    .from('affiliate_commissions')
    .select('id, affiliate_id')
    .eq('purchase_id', purchase.id)
    .eq('status', 'pending')

  if (commissions && commissions.length > 0) {
    await supabase
      .from('affiliate_commissions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('purchase_id', purchase.id)
      .eq('status', 'pending')

    for (const comm of commissions) {
      await supabase.rpc('increment_affiliate_conversions', {
        affiliate_uuid: comm.affiliate_id
      })
    }
    console.log('✅ Affiliate commissions approved')
  } else {
    // Fallback: create commission if referral exists but no commission was created
    const { data: referral } = await supabase
      .from('affiliate_referrals')
      .select('affiliate_id')
      .eq('referred_user_id', purchase.user_id)
      .eq('converted', true)
      .limit(1)
      .maybeSingle()

    if (referral) {
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('id, commission_rate, repurchase_commission_rate, status, commission_balance, total_commission_earned, total_conversions')
        .eq('id', referral.affiliate_id)
        .eq('status', 'active')
        .maybeSingle()

      if (affiliate) {
        const { data: existingComm } = await supabase
          .from('affiliate_commissions')
          .select('id')
          .eq('purchase_id', purchase.id)
          .limit(1)

        if (!existingComm || existingComm.length === 0) {
          const { count: prevPurchases } = await supabase
            .from('bid_purchases')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', purchase.user_id)
            .eq('payment_status', 'completed')
            .neq('id', purchase.id)

          const isRepurchase = (prevPurchases || 0) > 0
          const rate = isRepurchase
            ? (affiliate.repurchase_commission_rate || affiliate.commission_rate)
            : affiliate.commission_rate
          const commissionAmount = purchase.amount_paid * (rate / 100)

          await supabase.from('affiliate_commissions').insert({
            affiliate_id: affiliate.id,
            purchase_id: purchase.id,
            referred_user_id: purchase.user_id,
            purchase_amount: purchase.amount_paid,
            commission_rate: rate,
            commission_amount: commissionAmount,
            is_repurchase: isRepurchase,
            status: 'approved',
            approved_at: new Date().toISOString()
          })

          await supabase
            .from('affiliates')
            .update({
              commission_balance: (affiliate.commission_balance || 0) + commissionAmount,
              total_commission_earned: (affiliate.total_commission_earned || 0) + commissionAmount,
              total_conversions: (affiliate.total_conversions || 0) + 1
            })
            .eq('id', affiliate.id)

          console.log('✅ Affiliate commission created via check-status fallback')
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ status: 'paid', processed: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}