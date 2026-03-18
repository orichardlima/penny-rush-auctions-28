import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== ORDER PIX PAYMENT START (ASAAS) ===')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY')

    if (!asaasApiKey) {
      return new Response(
        JSON.stringify({ error: 'Asaas não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // 3. Buscar/criar customer no Asaas
    const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(userEmail)}`, {
      headers: { 'access_token': asaasApiKey }
    })
    const searchData = await searchRes.json()
    
    let customerId: string
    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id
    } else {
      const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName || 'Usuario',
          email: userEmail,
          cpfCnpj: cpf.replace(/\D/g, '')
        })
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        console.error('❌ Failed to create customer:', createData)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cliente no Asaas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      customerId = createData.id
    }

    // 4. Criar cobrança PIX
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 1)

    const chargeRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: Number(order.final_price),
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Pagamento do produto: ${order.product_name}`,
        externalReference: `order:${order.id}`
      })
    })
    const chargeData = await chargeRes.json()

    if (!chargeRes.ok) {
      console.error('❌ Asaas charge error:', chargeData)
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Asaas charge created:', chargeData.id)

    // 5. Obter QR Code
    const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${chargeData.id}/pixQrCode`, {
      headers: { 'access_token': asaasApiKey }
    })
    const qrData = await qrRes.json()

    // 6. Salvar payment_id no pedido
    await supabase
      .from('orders')
      .update({ payment_id: chargeData.id })
      .eq('id', order.id)

    const response = {
      orderId: order.id,
      paymentId: chargeData.id,
      qrCode: qrData.payload,
      qrCodeBase64: qrData.encodedImage,
      pixCopyPaste: qrData.payload,
      status: chargeData.status
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
