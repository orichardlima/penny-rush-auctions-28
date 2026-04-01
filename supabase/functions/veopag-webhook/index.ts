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
    console.log('=== VEOPAG WEBHOOK START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 VeoPag webhook payload:', JSON.stringify(body))

    const { type, external_id, transaction_id, status, amount } = body

    if (!external_id || !status) {
      console.log('ℹ️ Missing external_id or status, ignoring')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    console.log('💳 Type:', type, 'External ID:', external_id, 'Status:', status, 'Transaction:', transaction_id)

    const isApproved = status === 'COMPLETED'
    const isRejected = status === 'FAILED'

    if (!isApproved && !isRejected) {
      console.log('ℹ️ Status not actionable:', status)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Route by external_id prefix
    if (external_id.startsWith('regularize:')) {
      return await processRegularizationPayment(supabase, isApproved, isRejected, external_id)
    }

    if (external_id.startsWith('withdrawal:')) {
      return await processWithdrawalCallback(supabase, isApproved, isRejected, external_id, transaction_id)
    }

    if (external_id.startsWith('order:')) {
      return await processOrderPayment(supabase, isApproved, isRejected, external_id)
    }

    if (external_id.startsWith('cotas-upgrade:')) {
      return await processCotasUpgradePayment(supabase, isApproved, isRejected, external_id, transaction_id)
    }

    if (external_id.startsWith('upgrade:')) {
      return await processUpgradePayment(supabase, isApproved, isRejected, external_id, transaction_id)
    }

    // UUID → could be bid_purchase or partner_payment_intent
    // Try partner_payment_intent first
    const { data: intent } = await supabase
      .from('partner_payment_intents')
      .select('*')
      .eq('id', external_id)
      .maybeSingle()

    if (intent) {
      return await processNewContractPayment(supabase, isApproved, isRejected, intent, transaction_id)
    }

    // Try bid_purchase
    const { data: purchase } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('id', external_id)
      .maybeSingle()

    if (purchase) {
      return await processBidPurchase(supabase, isApproved, isRejected, purchase, transaction_id)
    }

    // Fallback: try by payment_id/transaction_id
    if (transaction_id) {
      const { data: purchaseByTx } = await supabase
        .from('bid_purchases')
        .select('*')
        .eq('payment_id', transaction_id)
        .maybeSingle()

      if (purchaseByTx) {
        return await processBidPurchase(supabase, isApproved, isRejected, purchaseByTx, transaction_id)
      }
    }

    console.log('ℹ️ No matching entity found for external_id:', external_id)
    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

// ===== ORDER PAYMENT =====
async function processOrderPayment(supabase: any, isApproved: boolean, isRejected: boolean, externalId: string) {
  const orderId = externalId.replace('order:', '')
  console.log('🛒 Processing ORDER payment for:', orderId)

  if (isApproved) {
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
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== NEW CONTRACT VIA PAYMENT INTENT =====
async function processNewContractPayment(supabase: any, isApproved: boolean, isRejected: boolean, intent: any, transactionId: string) {
  console.log('📄 Intent found:', intent.id, 'status:', intent.payment_status)

  if (isApproved && intent.payment_status !== 'approved') {
    console.log('✅ Payment approved, creating real contract')

    // Check idempotency
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

  } else if (isRejected) {
    console.log('❌ Payment rejected, updating intent')
    await supabase
      .from('partner_payment_intents')
      .update({ payment_status: 'expired' })
      .eq('id', intent.id)
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== BID PURCHASE =====
async function processBidPurchase(supabase: any, isApproved: boolean, isRejected: boolean, purchase: any, transactionId: string) {
  console.log('📦 Bid purchase found:', purchase.id, 'status:', purchase.payment_status)

  if (isApproved && purchase.payment_status !== 'completed') {
    console.log('✅ Bid payment approved, updating purchase and user balance')

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
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('purchase_id', purchase.id)
        .eq('status', 'pending')

      for (const comm of commissions) {
        await supabase.rpc('increment_affiliate_conversions', {
          affiliate_uuid: comm.affiliate_id
        })
      }
      console.log('✅ Affiliate commissions approved')
    } else {
      // FALLBACK: Create commission if none exists
      console.log('🔍 No commissions found, checking affiliate_referrals for buyer...')
      
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

            console.log(`💰 Creating commission: R$${commissionAmount} (${rate}%, repurchase=${isRepurchase})`)

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

  } else if (isRejected) {
    console.log('❌ Bid payment rejected')
    await supabase
      .from('bid_purchases')
      .update({ payment_status: 'failed' })
      .eq('id', purchase.id)

    await supabase
      .from('affiliate_commissions')
      .update({ status: 'cancelled' })
      .eq('purchase_id', purchase.id)
      .in('status', ['pending', 'approved'])
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== COTAS UPGRADE =====
async function processCotasUpgradePayment(supabase: any, isApproved: boolean, isRejected: boolean, externalId: string, transactionId: string) {
  const parts = externalId.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid cotas upgrade reference:', externalId)
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

  if (isApproved) {
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
      notes: `Upgrade de cotas: ${contract.cotas} → ${newCotas}. VeoPag TX: ${transactionId}`
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
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== WITHDRAWAL CALLBACK =====
async function processWithdrawalCallback(supabase: any, isApproved: boolean, isRejected: boolean, externalId: string, transactionId: string) {
  const withdrawalId = externalId.replace('withdrawal:', '')
  console.log('💸 Processing WITHDRAWAL callback for:', withdrawalId)

  const { data: withdrawal } = await supabase
    .from('partner_withdrawals')
    .select('*')
    .eq('id', withdrawalId)
    .single()

  if (!withdrawal) {
    console.log('⚠️ Withdrawal not found:', withdrawalId)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  // Idempotency: skip if already PAID
  if (withdrawal.status === 'PAID') {
    console.log('ℹ️ Withdrawal already PAID, skipping')
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  if (isApproved && withdrawal.status === 'APPROVED') {
    console.log('✅ Withdrawal confirmed by VeoPag webhook')

    const paymentDetails = withdrawal.payment_details as any
    await supabase
      .from('partner_withdrawals')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        payment_details: {
          ...paymentDetails,
          paid_via: 'veopag_webhook',
          veopag_transaction_id: transactionId,
          veopag_confirmed_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawalId)

    // Update contract total_withdrawn
    const { data: contractData } = await supabase
      .from('partner_contracts')
      .select('total_withdrawn')
      .eq('id', withdrawal.partner_contract_id)
      .single()

    if (contractData) {
      await supabase
        .from('partner_contracts')
        .update({
          total_withdrawn: (contractData.total_withdrawn || 0) + withdrawal.amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawal.partner_contract_id)
    }

    console.log('✅ Withdrawal marked as PAID via webhook')
  } else if (isRejected) {
    console.log('❌ Withdrawal rejected by VeoPag')
    // Don't change status - admin can retry
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

// ===== PLAN UPGRADE =====
async function processUpgradePayment(supabase: any, isApproved: boolean, isRejected: boolean, externalId: string, transactionId: string) {
  const parts = externalId.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid upgrade reference:', externalId)
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
      notes: `VeoPag TX: ${transactionId}`
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
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}
