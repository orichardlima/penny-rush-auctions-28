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

    // 2. Verificar se usuário já tem contrato ativo
    const { data: existingContract } = await supabase
      .from('partner_contracts')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (existingContract) {
      console.log('❌ User already has active contract:', existingContract.id)
      return new Response(
        JSON.stringify({ error: 'Você já possui um contrato ativo' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 3. Limpar intents expirados do mesmo usuário
    await supabase
      .from('partner_payment_intents')
      .delete()
      .eq('user_id', userId)
      .eq('payment_status', 'pending')
      .lt('expires_at', new Date().toISOString())

    console.log('🧹 Cleaned up expired intents')

    // 4. Buscar patrocinador se houver código de referral
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

    // 4b. Fallback: herdar referral de intent ou contrato anterior
    if (!referredByUserId) {
      // Tentar herdar de intent anterior
      const { data: prevIntent } = await supabase
        .from('partner_payment_intents')
        .select('referred_by_user_id')
        .eq('user_id', userId)
        .not('referred_by_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (prevIntent?.referred_by_user_id) {
        referredByUserId = prevIntent.referred_by_user_id
        console.log('✅ Referral herdado de intent anterior:', referredByUserId)
      } else {
        // Tentar herdar de contrato anterior (SUSPENDED/CLOSED)
        const { data: prevContract } = await supabase
          .from('partner_contracts')
          .select('referred_by_user_id')
          .eq('user_id', userId)
          .not('referred_by_user_id', 'is', null)
          .in('status', ['SUSPENDED', 'CLOSED'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (prevContract?.referred_by_user_id) {
          referredByUserId = prevContract.referred_by_user_id
          console.log('✅ Referral herdado de contrato anterior:', referredByUserId)
        }
      }
    }

    // 5. Criar payment intent (NÃO contrato)
    const { data: intentData, error: intentError } = await supabase
      .from('partner_payment_intents')
      .insert({
        user_id: userId,
        plan_id: planId,
        plan_name: planData.name,
        aporte_value: planData.aporte_value,
        weekly_cap: planData.weekly_cap,
        total_cap: planData.total_cap,
        bonus_bids: planData.bonus_bids || 0,
        referral_code: referralCode?.trim().toUpperCase() || null,
        referred_by_user_id: referredByUserId,
        payment_status: 'pending'
      })
      .select()
      .single()

    if (intentError) {
      console.error('❌ Payment intent creation failed:', intentError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar intenção de pagamento' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Payment intent created:', intentData.id)

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
      external_reference: intentData.id,
      notification_url: `${supabaseUrl}/functions/v1/partner-payment-webhook`
    }

    console.log('💳 Creating Mercado Pago payment:', paymentPayload)

    const idempotencyKey = `partner-intent-${intentData.id}-${Date.now()}`

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
      // Deletar intent se falhou
      await supabase
        .from('partner_payment_intents')
        .delete()
        .eq('id', intentData.id)
      
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar pagamento PIX' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Mercado Pago payment created:', mpData.id)

    // 7. Atualizar intent com dados do pagamento
    await supabase
      .from('partner_payment_intents')
      .update({ payment_id: mpData.id.toString() })
      .eq('id', intentData.id)

    // 8. Retornar dados para o frontend
    const response = {
      intentId: intentData.id,
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