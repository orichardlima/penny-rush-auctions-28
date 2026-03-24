import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

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
    console.log('=== PARTNER PAYMENT FUNCTION START (ASAAS) ===')
    
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
    const { planId, userId, userEmail, userName, userCpf, referralCode }: PartnerPaymentRequest = await req.json()

    console.log('📦 Request data:', { planId, userId, userEmail, userName, referralCode })

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

    console.log('✅ Plan found:', planData.name, planData.aporte_value)

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

    // 5. Criar payment intent
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Payment intent created:', intentData.id)

    // 6. Buscar/criar customer no Asaas
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
          cpfCnpj: userCpf.replace(/\D/g, '')
        })
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        await supabase.from('partner_payment_intents').delete().eq('id', intentData.id)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar cliente no Asaas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      customerId = createData.id
    }

    // 7. Criar cobrança PIX
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 1)

    const chargeRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: planData.aporte_value,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Parceria ${planData.display_name} - Aporte`,
        externalReference: intentData.id
      })
    })
    const chargeData = await chargeRes.json()

    if (!chargeRes.ok) {
      await supabase.from('partner_payment_intents').delete().eq('id', intentData.id)
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Obter QR Code
    const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${chargeData.id}/pixQrCode`, {
      headers: { 'access_token': asaasApiKey }
    })
    const qrData = await qrRes.json()

    // 9. Atualizar intent com payment_id
    await supabase
      .from('partner_payment_intents')
      .update({ payment_id: chargeData.id })
      .eq('id', intentData.id)

    const response = {
      intentId: intentData.id,
      paymentId: chargeData.id,
      qrCode: qrData.payload,
      qrCodeBase64: qrData.encodedImage,
      pixCopyPaste: qrData.payload,
      status: chargeData.status,
      planName: planData.display_name,
      aporteValue: planData.aporte_value,
      bonusBids: planData.bonus_bids || 0
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
