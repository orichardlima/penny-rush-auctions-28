import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { createDeposit } from '../_shared/payment-router.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface PartnerPaymentRequest {
  planId: string
  userId: string
  userEmail: string
  userName: string
  userCpf: string
  referralCode?: string
  cotas?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PARTNER PAYMENT FUNCTION START (VEOPAG) ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { planId, userId, userEmail, userName, userCpf, referralCode, cotas: rawCotas }: PartnerPaymentRequest = await req.json()
    const cotas = rawCotas || 1

    console.log('📦 Request data:', { planId, userId, userEmail, userName, referralCode, cotas })

    if (!userCpf) {
      return new Response(
        JSON.stringify({ error: 'CPF é obrigatório para gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Buscar dados do plano
    const { data: planData, error: planError } = await supabase
      .from('partner_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !planData) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar cotas
    const maxCotas = planData.max_cotas || 1
    if (cotas < 1 || cotas > maxCotas) {
      return new Response(
        JSON.stringify({ error: `Quantidade de cotas inválida. Máximo permitido: ${maxCotas}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aporteValue = planData.aporte_value * cotas
    const weeklyCap = planData.weekly_cap * cotas
    const totalCap = planData.total_cap * cotas
    const bonusBids = (planData.bonus_bids || 0) * cotas

    console.log('✅ Plan found:', planData.name, 'cotas:', cotas, 'aporte:', aporteValue)

    // 2. Verificar contrato ativo existente
    const { data: existingContract } = await supabase
      .from('partner_contracts')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (existingContract) {
      return new Response(
        JSON.stringify({ error: 'Você já possui um contrato ativo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Limpar intents expirados
    await supabase
      .from('partner_payment_intents')
      .delete()
      .eq('user_id', userId)
      .eq('payment_status', 'pending')
      .lt('expires_at', new Date().toISOString())

    // 4. Buscar patrocinador
    let referredByUserId: string | null = null
    
    if (referralCode) {
      const normalizedCode = referralCode.trim().toUpperCase()
      const { data: referrerContract } = await supabase
        .from('partner_contracts')
        .select('id, user_id, referral_code')
        .eq('referral_code', normalizedCode)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (referrerContract && referrerContract.user_id !== userId) {
        referredByUserId = referrerContract.user_id
        console.log('✅ Referrer encontrado:', referredByUserId)
      }
    }

    // 4b. Fallback: herdar referral
    if (!referredByUserId) {
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
      } else {
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
        }
      }
    }

    // 4c. Fallback: buscar indicação via affiliate_referrals
    if (!referredByUserId) {
      const { data: affiliateRef } = await supabase
        .from('affiliate_referrals')
        .select('affiliate_id, affiliates!inner(user_id)')
        .eq('referred_user_id', userId)
        .eq('converted', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (affiliateRef?.affiliates?.user_id) {
        referredByUserId = affiliateRef.affiliates.user_id
        console.log('✅ Referrer encontrado via affiliate_referrals:', referredByUserId)
      }
    }

    // 5. Criar payment intent
    const { data: intentData, error: intentError } = await supabase
      .from('partner_payment_intents')
      .insert({
        user_id: userId,
        plan_id: planId,
        plan_name: planData.name,
        aporte_value: aporteValue,
        weekly_cap: weeklyCap,
        total_cap: totalCap,
        bonus_bids: bonusBids,
        cotas,
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Payment intent created:', intentData.id)

    // 6. Criar cobrança VeoPag
    let depositResult
    try {
      depositResult = await createDeposit(supabase, {
        amount: aporteValue,
        externalId: intentData.id,
        description: `Parceria ${planData.display_name}${cotas > 1 ? ` (${cotas} cotas)` : ''} - Aporte`,
        payerName: userName || 'Usuario',
        payerEmail: userEmail,
        payerDocument: userCpf
      })
    } catch (err) {
      await supabase.from('partner_payment_intents').delete().eq('id', intentData.id)
      throw err
    }

    // 7. Atualizar intent com payment_id
    await supabase
      .from('partner_payment_intents')
      .update({ payment_id: depositResult.transactionId })
      .eq('id', intentData.id)

    const response = {
      intentId: intentData.id,
      paymentId: depositResult.transactionId,
      qrCodeBase64: depositResult.qrCodeBase64,
      pixCopyPaste: depositResult.pixCopyPaste || null,
      status: depositResult.status,
      planName: planData.display_name,
      aporteValue: aporteValue,
      bonusBids: bonusBids,
      cotas
    }

    console.log('✅ Partner payment response ready')
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
