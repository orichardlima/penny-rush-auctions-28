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
    console.log('=== ORDER PIX PAYMENT START ===')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    if (!mercadoPagoAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Mercado Pago não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { orderId, userId, userEmail, userName } = await req.json()

    console.log('📦 Order payment request:', { orderId, userId })

    // 1. Buscar pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('winner_id', userId)
      .eq('status', 'awaiting_payment')
      .single()

    if (orderError || !order) {
      console.error('❌ Order not found or not awaiting payment:', orderError)
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado ou já pago' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Order found:', order.id, order.product_name, order.final_price)

    // 2. Criar pagamento no Mercado Pago
    const paymentPayload = {
      transaction_amount: Number(order.final_price),
      description: `Pagamento do produto: ${order.product_name}`,
      payment_method_id: "pix",
      payer: {
        email: userEmail,
        first_name: userName || 'Usuario',
        last_name: ''
      },
      external_reference: `order:${order.id}`,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`
    }

    console.log('💳 Creating Mercado Pago payment for order:', paymentPayload)

    const idempotencyKey = `order-${order.id}-${Date.now()}`

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadoPagoAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(paymentPayload)
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('❌ Mercado Pago API error:', mpData)
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Mercado Pago payment created:', mpData.id)

    // 3. Salvar payment_id no pedido
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_id: mpData.id.toString() })
      .eq('id', order.id)

    if (updateError) {
      console.error('❌ Order update failed:', updateError)
    }

    // 4. Retornar dados PIX
    const response = {
      orderId: order.id,
      paymentId: mpData.id,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopyPaste: mpData.point_of_interaction?.transaction_data?.qr_code,
      status: mpData.status
    }

    console.log('✅ Order payment response ready')

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
