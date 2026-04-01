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
    console.log('=== MAGEN WEBHOOK START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 MagenPay webhook payload:', JSON.stringify(body))

    // MagenPay sends: { type: "pixRequestIn", data: { txId, amount, status, endToEndId, ... } }
    const { type, data } = body

    if (type !== 'pixRequestIn') {
      console.log('ℹ️ Ignoring non-pixRequestIn event:', type)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    if (!data || data.status !== 'success' || data.flow !== 'IN') {
      console.log('ℹ️ Payment not successful or not IN flow:', data?.status, data?.flow)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const txId = data.txId || data.externalId || ''
    const amount = data.amount
    const endToEndId = data.endToEndId || ''

    console.log('💳 TxId:', txId, 'Amount:', amount, 'EndToEnd:', endToEndId)

    if (!txId) {
      console.log('⚠️ No txId found in webhook')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Route by txId prefix (same logic as veopag-webhook)
    if (txId.startsWith('regularize:')) {
      return await processRegularizationPayment(supabase, txId)
    }

    if (txId.startsWith('order:')) {
      return await processOrderPayment(supabase, txId)
    }

    if (txId.startsWith('cotas-upgrade:')) {
      return await processCotasUpgradePayment(supabase, txId, endToEndId)
    }

    if (txId.startsWith('upgrade:')) {
      return await processUpgradePayment(supabase, txId, endToEndId)
    }

    // UUID format → partner_payment_intent or bid_purchase
    const { data: intent } = await supabase
      .from('partner_payment_intents')
      .select('*')
      .eq('id', txId)
      .maybeSingle()

    if (intent) {
      return await processNewContractPayment(supabase, intent, endToEndId)
    }

    const { data: purchase } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('id', txId)
      .maybeSingle()

    if (purchase) {
      return await processBidPurchase(supabase, purchase, endToEndId)
    }

    console.log('ℹ️ No matching entity found for txId:', txId)
    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ Magen webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

// ===== ORDER PAYMENT =====
async function processOrderPayment(supabase: any, txId: string) {
  const orderId = txId.replace('order:', '')
  console.log('🛒 Processing ORDER payment for:', orderId)

  const { error } = await supabase
    .from('orders')
    .update({ status: 'paid', payment_method: 'PIX' })
    .eq('id', orderId)
    .neq('status', 'paid')

  if (error) {
    console.error('❌ Order update failed:', error)
  } else {
    console.log('✅ Order marked as paid')
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== NEW CONTRACT =====
async function processNewContractPayment(supabase: any, intent: any, transactionId: string) {
  console.log('📄 Intent found:', intent.id, 'status:', intent.payment_status)

  if (intent.payment_status === 'approved') {
    console.log('ℹ️ Intent already approved, skipping')
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  const { data: existingActive } = await supabase
    .from('partner_contracts')
    .select('id')
    .eq('user_id', intent.user_id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (existingActive) {
    console.log('⚠️ User already has active contract, skipping')
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
      cotas: intent.cotas || 1,
      status: 'ACTIVE',
      payment_status: 'completed',
      payment_id: transactionId,
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

  await supabase
    .from('partner_payment_intents')
    .update({ payment_status: 'approved' })
    .eq('id', intent.id)

  console.log('✅ Partner contract activation completed')
  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== BID PURCHASE =====
async function processBidPurchase(supabase: any, purchase: any, transactionId: string) {
  console.log('📦 Bid purchase found:', purchase.id, 'status:', purchase.payment_status)

  if (purchase.payment_status === 'completed') {
    console.log('ℹ️ Purchase already completed, skipping')
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  await supabase
    .from('bid_purchases')
    .update({ payment_status: 'completed' })
    .eq('id', purchase.id)

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
  }

  console.log('✅ Bid purchase completed: +' + purchase.bids_purchased + ' lances')

  // Approve affiliate commissions
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
    // Fallback: create commission if referral exists
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

          console.log('✅ Affiliate commission created via webhook fallback')
        }
      }
    }
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== COTAS UPGRADE =====
async function processCotasUpgradePayment(supabase: any, txId: string, transactionId: string) {
  const parts = txId.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid cotas upgrade reference:', txId)
    return new Response('Invalid reference', { status: 400, headers: corsHeaders })
  }

  const contractId = parts[1]
  const newCotas = parseInt(parts[2], 10)

  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return new Response('Contract not found', { status: 404, headers: corsHeaders })
  }

  const { data: currentPlan } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('name', contract.plan_name)
    .eq('is_active', true)
    .single()

  if (!currentPlan) {
    return new Response('Plan not found', { status: 404, headers: corsHeaders })
  }

  console.log('✅ Cotas upgrade payment approved:', contract.cotas, '→', newCotas)

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
    notes: `Upgrade de cotas: ${contract.cotas} → ${newCotas}. MagenPay TX: ${transactionId}`
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

  console.log('✅ Contract cotas upgraded:', contract.cotas, '→', newCotas)
  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== PLAN UPGRADE =====
async function processUpgradePayment(supabase: any, txId: string, transactionId: string) {
  const parts = txId.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid upgrade reference:', txId)
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

  console.log('✅ Upgrade payment approved')

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
    notes: `MagenPay TX: ${transactionId}`
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
  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== REGULARIZATION PAYMENT =====
async function processRegularizationPayment(supabase: any, txId: string) {
  const contractId = txId.replace('regularize:', '')
  console.log('🔄 Processing REGULARIZATION payment for contract:', contractId)

  const { error } = await supabase
    .from('partner_contracts')
    .update({
      financial_status: 'paid',
      financial_status_note: 'Pagamento regularizado via PIX (MagenPay)',
      financial_status_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', contractId)
    .neq('financial_status', 'paid')

  if (error) {
    console.error('❌ Regularization update failed:', error)
  } else {
    console.log('✅ Contract regularized successfully')
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}
