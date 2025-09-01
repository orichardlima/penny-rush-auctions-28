import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequest {
  packageId: string
  userId: string
  userEmail: string
  userName: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== MERCADO PAGO PAYMENT FUNCTION START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    if (!mercadoPagoAccessToken) {
      console.error('❌ MERCADO_PAGO_ACCESS_TOKEN não configurado')
      return new Response(
        JSON.stringify({ error: 'Mercado Pago não configurado' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Environment variables OK')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { packageId, userId, userEmail, userName }: PaymentRequest = await req.json()

    console.log('📦 Request data:', { packageId, userId, userEmail, userName })

    // 1. Buscar dados do pacote
    const { data: packageData, error: packageError } = await supabase
      .from('bid_packages')
      .select('*')
      .eq('id', packageId)
      .single()

    if (packageError || !packageData) {
      console.error('❌ Package not found:', packageError)
      return new Response(
        JSON.stringify({ error: 'Pacote não encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Package found:', packageData.name, packageData.price)

    // 2. Criar pedido de compra no banco (status pending)
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('bid_purchases')
      .insert({
        user_id: userId,
        package_id: packageId,
        bids_purchased: packageData.bids_count,
        amount_paid: packageData.price,
        payment_status: 'pending'
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('❌ Purchase creation failed:', purchaseError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar pedido' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Purchase created:', purchaseData.id)

    // 3. Criar pagamento no Mercado Pago
    const paymentPayload = {
      transaction_amount: packageData.price,
      description: `${packageData.name} - ${packageData.bids_count} lances`,
      payment_method_id: "pix",
      payer: {
        email: userEmail,
        first_name: userName || 'Usuario',
        last_name: ''
      },
      external_reference: purchaseData.id,
      notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`
    }

    console.log('💳 Creating Mercado Pago payment:', paymentPayload)

    // Gerar chave de idempotência única
    const idempotencyKey = `${purchaseData.id}-${Date.now()}`

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
      // Deletar compra se falhou
      await supabase
        .from('bid_purchases')
        .delete()
        .eq('id', purchaseData.id)
      
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar pagamento PIX' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Mercado Pago payment created:', mpData.id)

    // 4. Atualizar compra com dados do pagamento
    const { error: updateError } = await supabase
      .from('bid_purchases')
      .update({
        payment_id: mpData.id.toString(),
        external_reference: mpData.external_reference
      })
      .eq('id', purchaseData.id)

    if (updateError) {
      console.error('❌ Purchase update failed:', updateError)
    }

    // 5. Retornar dados para o frontend
    const response = {
      purchaseId: purchaseData.id,
      paymentId: mpData.id,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopyPaste: mpData.point_of_interaction?.transaction_data?.qr_code,
      status: mpData.status
    }

    console.log('✅ Payment response ready:', response)

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})