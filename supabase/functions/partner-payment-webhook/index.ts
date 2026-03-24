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

    // Verificar se é UPGRADE DE COTAS
    if (externalReference.startsWith('cotas-upgrade:')) {
      console.log('📦 Processing COTAS UPGRADE payment')
      return await processCotasUpgradePayment(supabase, isApproved, isRejected, externalReference, paymentId)
    }

    // Verificar se é UPGRADE DE PLANO
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
    return await processLegacyContractPayment(supabase, isApproved, isRejected, paymentId, externalReference)
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
        cotas: intent.cotas || 1,
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

async function processLegacyContractPayment(supabase: any, isApproved: boolean, isRejected: boolean, paymentId: string, externalReference?: string) {
  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('payment_id', paymentId)
    .single()

  if (!contract) {
    // Fallback: verificar se é uma compra de lances (bid_purchases)
    console.log('ℹ️ Not a partner contract, checking bid_purchases...')
    return await processBidPurchaseFallback(supabase, isApproved, isRejected, paymentId, externalReference || '')
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
  } else if (isRejected) {
    await supabase
      .from('partner_contracts')
      .update({ status: 'SUSPENDED', payment_status: 'failed' })
      .eq('id', contract.id)
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}

async function processBidPurchaseFallback(supabase: any, isApproved: boolean, isRejected: boolean, paymentId: string, externalReference: string) {
  // Buscar compra pelo payment_id
  let purchase = null

  const { data: purchaseByPayment } = await supabase
    .from('bid_purchases')
    .select('*')
    .eq('payment_id', paymentId)
    .single()

  if (purchaseByPayment) {
    purchase = purchaseByPayment
  } else if (externalReference) {
    // Fallback: buscar pelo external_reference (= purchase.id)
    const { data: purchaseByRef } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('id', externalReference)
      .single()
    purchase = purchaseByRef
  }

  // Verificar se é um pedido (order)
  if (!purchase && externalReference.startsWith('order:')) {
    const orderId = externalReference.replace('order:', '')
    console.log('🛒 Processing ORDER payment for:', orderId)

    if (isApproved) {
      await supabase
        .from('orders')
        .update({ status: 'paid', payment_method: 'PIX' })
        .eq('id', orderId)
        .neq('status', 'paid')
      console.log('✅ Order marked as paid')
    }
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  if (!purchase) {
    console.log('ℹ️ Payment not related to any known entity, ignoring:', paymentId)
    return new Response('OK', { status: 200, headers: corsHeaders })
  }

  console.log('📦 Bid purchase found:', purchase.id, 'status:', purchase.payment_status)

  if (isApproved && purchase.payment_status !== 'completed') {
    console.log('✅ Bid payment approved, updating purchase and user balance')

    // Atualizar status da compra
    await supabase
      .from('bid_purchases')
      .update({ payment_status: 'completed' })
      .eq('id', purchase.id)

    // Atualizar saldo do usuário
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

    // Aprovar comissões de afiliado existentes
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
      // FALLBACK: Criar comissão se não existe nenhuma para esta compra
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
          // Verificar se já existe alguma comissão (qualquer status) para esta compra
          const { data: existingComm } = await supabase
            .from('affiliate_commissions')
            .select('id')
            .eq('purchase_id', purchase.id)
            .limit(1)

          if (!existingComm || existingComm.length === 0) {
            // Verificar se é 1ª compra ou recompra
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

            // Atualizar saldo e totais do afiliado
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
      } else {
        console.log('ℹ️ Buyer has no affiliate referral, skipping commission')
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
