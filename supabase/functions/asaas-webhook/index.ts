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
    console.log('=== ASAAS WEBHOOK START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 Webhook payload:', JSON.stringify(body))

    const event = body.event
    const payment = body.payment

    if (!payment) {
      console.log('ℹ️ No payment data in webhook, ignoring')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const paymentId = payment.id
    const externalReference = payment.externalReference || ''
    const status = payment.status

    console.log('💳 Event:', event, 'Payment:', paymentId, 'Status:', status, 'Ref:', externalReference)

    // Determinar se pagamento foi aprovado ou rejeitado
    const isApproved = event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || status === 'RECEIVED' || status === 'CONFIRMED'
    const isRejected = event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED' || status === 'OVERDUE' || status === 'REFUNDED'

    if (!isApproved && !isRejected) {
      console.log('ℹ️ Event not actionable:', event)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Verificar se é pagamento de pedido (order)
    const isOrderPayment = externalReference.startsWith('order:')

    if (isOrderPayment) {
      const orderId = externalReference.replace('order:', '')
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
      } else if (isRejected) {
        console.log('❌ Order payment rejected/overdue')
      }

      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // === FLUXO PRINCIPAL: COMPRA DE LANCES ===
    // externalReference = purchase.id
    const { data: purchase, error: purchaseError } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('payment_id', paymentId)
      .single()

    if (purchaseError || !purchase) {
      // Fallback: tentar por external_reference
      const { data: purchaseByRef } = await supabase
        .from('bid_purchases')
        .select('*')
        .eq('id', externalReference)
        .single()

      if (!purchaseByRef) {
        console.error('❌ Purchase not found for payment:', paymentId)
        return new Response('Purchase not found', { status: 404, headers: corsHeaders })
      }

      return await processBidPurchase(supabase, purchaseByRef, isApproved, isRejected)
    }

    return await processBidPurchase(supabase, purchase, isApproved, isRejected)

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

async function processBidPurchase(supabase: any, purchase: any, isApproved: boolean, isRejected: boolean) {
  console.log('📦 Purchase found:', purchase.id, 'current status:', purchase.payment_status)

  if (isApproved && purchase.payment_status !== 'completed') {
    console.log('✅ Payment approved, updating purchase and user balance')
    
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

    console.log('✅ Purchase completed successfully')

    // Aprovar comissões de afiliado
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
    }
    
  } else if (isRejected) {
    console.log('❌ Payment rejected, updating status')
    
    await supabase
      .from('bid_purchases')
      .update({ payment_status: 'failed' })
      .eq('id', purchase.id)

    await supabase
      .from('affiliate_commissions')
      .update({ status: 'cancelled' })
      .eq('purchase_id', purchase.id)
      .in('status', ['pending', 'approved'])

    console.log('✅ Purchase marked as failed and commissions cancelled')
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}
