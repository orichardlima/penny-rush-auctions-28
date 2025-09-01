import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== MERCADO PAGO WEBHOOK START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 Webhook payload:', body)

    // Verificar se é notificação de pagamento
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
      headers: {
        'Authorization': `Bearer ${mercadoPagoAccessToken}`
      }
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

    // 2. Buscar compra no banco
    const { data: purchase, error: purchaseError } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('payment_id', paymentId.toString())
      .single()

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', purchaseError)
      return new Response('Purchase not found', { status: 404, headers: corsHeaders })
    }

    console.log('📦 Purchase found:', purchase.id, 'current status:', purchase.payment_status)

    // 3. Processar baseado no status do pagamento
    if (paymentData.status === 'approved' && purchase.payment_status !== 'completed') {
      console.log('✅ Payment approved, updating purchase and user balance')
      
      // Atualizar status da compra
      const { error: updateError } = await supabase
        .from('bid_purchases')
        .update({ payment_status: 'completed' })
        .eq('id', purchase.id)

      if (updateError) {
        console.error('❌ Failed to update purchase:', updateError)
        return new Response('Update failed', { status: 500, headers: corsHeaders })
      }

      // Atualizar saldo do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('bids_balance')
        .eq('user_id', purchase.user_id)
        .single()

      if (profileError) {
        console.error('❌ Failed to get user profile:', profileError)
        return new Response('Profile fetch failed', { status: 500, headers: corsHeaders })
      }

      const newBalance = (profile.bids_balance || 0) + purchase.bids_purchased
      
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', purchase.user_id)

      if (balanceError) {
        console.error('❌ Failed to update user balance:', balanceError)
        return new Response('Balance update failed', { status: 500, headers: corsHeaders })
      }

      console.log('✅ Purchase completed successfully')
      
    } else if (paymentData.status === 'cancelled' || paymentData.status === 'rejected') {
      console.log('❌ Payment cancelled/rejected, updating status')
      
      await supabase
        .from('bid_purchases')
        .update({ payment_status: 'failed' })
        .eq('id', purchase.id)
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})