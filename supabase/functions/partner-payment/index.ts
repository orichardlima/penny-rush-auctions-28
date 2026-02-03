import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PartnerPaymentRequest {
  planId: string
  userId: string
  userEmail: string
  userName: string
  referralCode?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PARTNER PAYMENT FUNCTION START ===')
    
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
    const { planId, userId, userEmail, userName, referralCode }: PartnerPaymentRequest = await req.json()

    console.log('📦 Request data:', { planId, userId, userEmail, userName, referralCode })

    // 1. Buscar dados do plano de parceiro
    const { data: planData, error: planError } = await supabase
      .from('partner_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !planData) {
      console.error('❌ Plan not found:', planError)
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Plan found:', planData.name, planData.aporte_value)

    // 2. Verificar se usuário já tem contrato ativo ou pendente
    const { data: existingContract } = await supabase
      .from('partner_contracts')
      .select('id, status, payment_status')
      .eq('user_id', userId)
      .in('status', ['ACTIVE', 'PENDING'])
      .maybeSingle()

    if (existingContract) {
      console.log('❌ User already has active/pending contract:', existingContract.id)
      return new Response(
        JSON.stringify({ 
          error: existingContract.status === 'ACTIVE' 
            ? 'Você já possui um contrato ativo' 
            : 'Você já possui um pagamento pendente'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 3. Buscar patrocinador se houver código de referral
    let referredByUserId: string | null = null
    
    if (referralCode) {
      const normalizedCode = referralCode.trim().toUpperCase()
      console.log('🔍 Buscando referrer com código:', normalizedCode)
      
      const { data: referrerContract, error: referrerError } = await supabase
        .from('partner_contracts')
        .select('id, user_id, referral_code')
        .eq('referral_code', normalizedCode)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (referrerError) {
        console.warn('⚠️ Erro ao buscar referrer:', referrerError)
      } else if (referrerContract) {
        if (referrerContract.user_id !== userId) {
          referredByUserId = referrerContract.user_id
          console.log('✅ Referrer encontrado:', referredByUserId)
        } else {
          console.warn('⚠️ Usuário tentando usar próprio código de referral')
        }
      } else {
        console.warn('⚠️ Nenhum contrato ativo encontrado com código:', normalizedCode)
      }
    }

    // 4. Gerar código de indicação único para o novo parceiro
    const newReferralCode = Math.random().toString(36).substring(2, 10).toUpperCase()

    // 5. Criar contrato com status PENDING e payment_status pending
    const { data: contractData, error: contractError } = await supabase
      .from('partner_contracts')
      .insert({
        user_id: userId,
        plan_name: planData.name,
        aporte_value: planData.aporte_value,
        weekly_cap: planData.weekly_cap,
        total_cap: planData.total_cap,
        status: 'PENDING',
        payment_status: 'pending',
        referred_by_user_id: referredByUserId,
        referral_code: newReferralCode
      })
      .select()
      .single()

    if (contractError) {
      console.error('❌ Contract creation failed:', contractError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar contrato' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Contract created (PENDING):', contractData.id)

    // 6. Criar pagamento no Mercado Pago
    const paymentPayload = {
      transaction_amount: planData.aporte_value,
      description: `Parceria ${planData.display_name} - Aporte`,
      payment_method_id: "pix",
      payer: {
        email: userEmail,
        first_name: userName || 'Usuario',
        last_name: ''
      },
      external_reference: contractData.id,
      notification_url: `${supabaseUrl}/functions/v1/partner-payment-webhook`
    }

    console.log('💳 Creating Mercado Pago payment:', paymentPayload)

    // Gerar chave de idempotência única
    const idempotencyKey = `partner-${contractData.id}-${Date.now()}`

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
      // Deletar contrato se falhou
      await supabase
        .from('partner_contracts')
        .delete()
        .eq('id', contractData.id)
      
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar pagamento PIX' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Mercado Pago payment created:', mpData.id)

    // 7. Atualizar contrato com dados do pagamento
    const { error: updateError } = await supabase
      .from('partner_contracts')
      .update({
        payment_id: mpData.id.toString()
      })
      .eq('id', contractData.id)

    if (updateError) {
      console.error('❌ Contract update failed:', updateError)
    }

    // 8. Retornar dados para o frontend
    const response = {
      contractId: contractData.id,
      paymentId: mpData.id,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopyPaste: mpData.point_of_interaction?.transaction_data?.qr_code,
      status: mpData.status,
      planName: planData.display_name,
      aporteValue: planData.aporte_value,
      bonusBids: planData.bonus_bids || 0
    }

    console.log('✅ Partner payment response ready:', response)
    console.log('=== PARTNER PAYMENT FUNCTION END ===')

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
