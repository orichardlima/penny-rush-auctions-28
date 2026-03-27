import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { createVeopagDeposit } from '../_shared/veopag-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== ORDER PIX PAYMENT START (VEOPAG) ===')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { orderId, userId, userEmail, userName, userCpf } = await req.json()

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
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado ou já pago' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Order found:', order.id, order.product_name, order.final_price)

    // 2. Buscar CPF do perfil se não enviado
    let cpf = userCpf
    if (!cpf) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cpf')
        .eq('user_id', userId)
        .single()
      cpf = profile?.cpf
    }

    if (!cpf) {
      return new Response(
        JSON.stringify({ error: 'CPF é obrigatório para gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Criar cobrança VeoPag
    const externalId = `order:${order.id}`
    const depositResult = await createVeopagDeposit({
      amount: Number(order.final_price),
      external_id: externalId,
      description: `Pagamento do produto: ${order.product_name}`,
      payer: {
        name: userName || 'Usuario',
        email: userEmail,
        document: cpf
      }
    })

    // 4. Salvar payment_id no pedido
    await supabase
      .from('orders')
      .update({ payment_id: depositResult.transactionId })
      .eq('id', order.id)

    const response = {
      orderId: order.id,
      paymentId: depositResult.transactionId,
      qrCodeBase64: depositResult.qrCodeBase64,
      pixCopyPaste: null,
      status: depositResult.status
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
