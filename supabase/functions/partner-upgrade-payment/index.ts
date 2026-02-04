import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PartnerUpgradePaymentRequest {
  contractId: string
  newPlanId: string
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
    console.log('=== PARTNER UPGRADE PAYMENT FUNCTION START ===')
    
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
    const { contractId, newPlanId, userId, userEmail, userName }: PartnerUpgradePaymentRequest = await req.json()

    console.log('📦 Request data:', { contractId, newPlanId, userId, userEmail, userName })

    // 1. Buscar contrato atual
    const { data: contract, error: contractError } = await supabase
      .from('partner_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      console.error('❌ Contract not found:', contractError)
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Contract found:', contract.id, 'Plan:', contract.plan_name)

    // 2. Validar contrato está ativo
    if (contract.status !== 'ACTIVE') {
      console.error('❌ Contract not active:', contract.status)
      return new Response(
        JSON.stringify({ error: 'Só é possível fazer upgrade em contratos ativos' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 3. Validar progresso < 80%
    const progressPercentage = (contract.total_received / contract.total_cap) * 100
    if (progressPercentage >= 80) {
      console.error('❌ Contract progress >= 80%:', progressPercentage)
      return new Response(
        JSON.stringify({ error: 'Você já atingiu mais de 80% do teto atual. Aguarde o encerramento.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 4. Buscar novo plano
    const { data: newPlan, error: planError } = await supabase
      .from('partner_plans')
      .select('*')
      .eq('id', newPlanId)
      .eq('is_active', true)
      .single()

    if (planError || !newPlan) {
      console.error('❌ New plan not found:', planError)
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ New plan found:', newPlan.name, newPlan.aporte_value)

    // 5. Validar plano superior
    if (newPlan.aporte_value <= contract.aporte_value) {
      console.error('❌ New plan not superior:', newPlan.aporte_value, '<=', contract.aporte_value)
      return new Response(
        JSON.stringify({ error: 'Só é possível fazer upgrade para um plano superior' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 6. Calcular diferença a pagar
    const differenceToPay = newPlan.aporte_value - contract.aporte_value
    console.log('💰 Difference to pay:', differenceToPay)

    // 7. Criar pagamento no Mercado Pago
    const externalReference = `upgrade:${contractId}:${newPlanId}`
    
    const paymentPayload = {
      transaction_amount: differenceToPay,
      description: `Upgrade de Parceria: ${contract.plan_name} → ${newPlan.display_name}`,
      payment_method_id: "pix",
      payer: {
        email: userEmail,
        first_name: userName || 'Usuario',
        last_name: ''
      },
      external_reference: externalReference,
      notification_url: `${supabaseUrl}/functions/v1/partner-payment-webhook`
    }

    console.log('💳 Creating Mercado Pago payment:', paymentPayload)

    // Gerar chave de idempotência única
    const idempotencyKey = `partner-upgrade-${contractId}-${newPlanId}-${Date.now()}`

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
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Mercado Pago payment created:', mpData.id)

    // 8. Retornar dados para o frontend
    const response = {
      paymentId: mpData.id,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopyPaste: mpData.point_of_interaction?.transaction_data?.qr_code,
      status: mpData.status,
      contractId: contractId,
      previousPlanName: contract.plan_name,
      newPlanName: newPlan.display_name,
      differenceToPay: differenceToPay,
      newAporteValue: newPlan.aporte_value,
      newTotalCap: newPlan.total_cap,
      newWeeklyCap: newPlan.weekly_cap
    }

    console.log('✅ Partner upgrade payment response ready:', response)
    console.log('=== PARTNER UPGRADE PAYMENT FUNCTION END ===')

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
