import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

interface PaymentRequest {
  packageId: string
  userId: string
  userEmail: string
  userName: string
  userCpf: string
  referralCode?: string
}

async function getOrCreateCustomer(apiKey: string, email: string, name: string, cpfCnpj: string): Promise<string> {
  // 1. Buscar customer existente por email
  const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(email)}`, {
    headers: { 'access_token': apiKey }
  })
  const searchData = await searchRes.json()

  if (searchData.data && searchData.data.length > 0) {
    console.log('✅ Customer found:', searchData.data[0].id)
    return searchData.data[0].id
  }

  // 2. Criar novo customer
  const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name || 'Usuario',
      email: email,
      cpfCnpj: cpfCnpj.replace(/\D/g, '')
    })
  })
  const createData = await createRes.json()

  if (!createRes.ok) {
    console.error('❌ Failed to create Asaas customer:', createData)
    throw new Error('Erro ao criar cliente no Asaas')
  }

  console.log('✅ Customer created:', createData.id)
  return createData.id
}

async function createPixCharge(apiKey: string, customerId: string, value: number, description: string, externalReference: string) {
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 1)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  const chargeRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: value,
      dueDate: dueDateStr,
      description: description,
      externalReference: externalReference,
      callbackUrl: 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/asaas-webhook'
    })
  })
  const chargeData = await chargeRes.json()

  if (!chargeRes.ok) {
    console.error('❌ Failed to create Asaas charge:', chargeData)
    throw new Error('Erro ao criar cobrança PIX')
  }

  console.log('✅ Asaas charge created:', chargeData.id)
  return chargeData
}

async function getPixQrCode(apiKey: string, paymentId: string) {
  const qrRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, {
    headers: { 'access_token': apiKey }
  })
  const qrData = await qrRes.json()

  if (!qrRes.ok) {
    console.error('❌ Failed to get QR Code:', qrData)
    throw new Error('Erro ao gerar QR Code PIX')
  }

  return qrData
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== ASAAS PAYMENT FUNCTION START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY')

    if (!asaasApiKey) {
      console.error('❌ ASAAS_API_KEY não configurado')
      return new Response(
        JSON.stringify({ error: 'Asaas não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { packageId, userId, userEmail, userName, userCpf, referralCode }: PaymentRequest = await req.json()

    console.log('📦 Request data:', { packageId, userId, userEmail, userName, referralCode })

    if (!userCpf) {
      return new Response(
        JSON.stringify({ error: 'CPF é obrigatório para gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Package found:', packageData.name, packageData.price)

    // 2. Buscar configurações de promoção de multiplicador
    const { data: promoSettings, error: promoError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'promo_multiplier_enabled',
        'promo_multiplier_value',
        'promo_multiplier_expires_at',
        'promo_multiplier_mode'
      ])

    let promoMultiplier = 1
    let promoMode = 'base'
    let promoApplied = false

    if (!promoError && promoSettings) {
      const settings: Record<string, string> = {}
      promoSettings.forEach(s => {
        settings[s.setting_key] = s.setting_value
      })

      const promoEnabled = settings['promo_multiplier_enabled'] === 'true'
      const promoExpires = settings['promo_multiplier_expires_at'] || ''
      const multiplierValue = parseFloat(settings['promo_multiplier_value'] || '1') || 1
      promoMode = settings['promo_multiplier_mode'] || 'base'

      const isExpired = promoExpires && new Date(promoExpires) < new Date()
      const isPromoValid = promoEnabled && !isExpired

      if (isPromoValid && multiplierValue > 1) {
        promoMultiplier = multiplierValue
        promoApplied = true
        console.log(`🎉 Promoção ativa! Multiplicador: ${promoMultiplier}x, Modo: ${promoMode}`)
      }
    }

    // 3. Calcular lances finais com promoção
    const baseBidsFromPrice = Math.floor(packageData.price)
    const totalBidsFromPackage = packageData.bids_count
    let finalBidsCount = totalBidsFromPackage

    if (promoApplied) {
      switch (promoMode) {
        case 'base':
          finalBidsCount = Math.floor(baseBidsFromPrice * promoMultiplier)
          break
        case 'total':
          finalBidsCount = Math.floor(totalBidsFromPackage * promoMultiplier)
          break
        case 'bonus':
          const bonusBids = Math.floor(baseBidsFromPrice * (promoMultiplier - 1))
          finalBidsCount = totalBidsFromPackage + bonusBids
          break
        default:
          finalBidsCount = Math.floor(baseBidsFromPrice * promoMultiplier)
      }
    }
    
    console.log(`📊 Lances: base=${baseBidsFromPrice}, multiplicador=${promoMultiplier}, final=${finalBidsCount}`)

    // 4. Criar pedido de compra no banco (status pending)
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('bid_purchases')
      .insert({
        user_id: userId,
        package_id: packageId,
        bids_purchased: finalBidsCount,
        amount_paid: packageData.price,
        payment_status: 'pending'
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('❌ Purchase creation failed:', purchaseError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar pedido' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Purchase created:', purchaseData.id, `(${finalBidsCount} lances)`)

    // 5. Criar customer e cobrança no Asaas
    const customerId = await getOrCreateCustomer(asaasApiKey, userEmail, userName, userCpf)

    const descriptionSuffix = promoApplied ? ` (${promoMultiplier}x PROMO)` : ''
    const chargeData = await createPixCharge(
      asaasApiKey,
      customerId,
      packageData.price,
      `${packageData.name} - ${finalBidsCount} lances${descriptionSuffix}`,
      purchaseData.id
    )

    // 6. Obter QR Code
    const qrData = await getPixQrCode(asaasApiKey, chargeData.id)

    // 7. Atualizar compra com dados do pagamento
    await supabase
      .from('bid_purchases')
      .update({
        payment_id: chargeData.id,
        external_reference: purchaseData.id
      })
      .eq('id', purchaseData.id)

    // 8. Retornar dados para o frontend
    const response = {
      purchaseId: purchaseData.id,
      paymentId: chargeData.id,
      qrCode: qrData.payload,
      qrCodeBase64: qrData.encodedImage,
      pixCopyPaste: qrData.payload,
      status: chargeData.status,
      promoApplied,
      finalBidsCount
    }

    console.log('✅ Payment response ready')

    // 9. Processar comissão de afiliado
    let effectiveReferralCode = referralCode || null

    if (!effectiveReferralCode) {
      const { data: referralRecord } = await supabase
        .from('affiliate_referrals')
        .select('affiliate_id')
        .eq('referred_user_id', userId)
        .eq('converted', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (referralRecord) {
        const { data: affiliateRecord } = await supabase
          .from('affiliates')
          .select('affiliate_code')
          .eq('id', referralRecord.affiliate_id)
          .eq('status', 'active')
          .maybeSingle()

        if (affiliateRecord) {
          effectiveReferralCode = affiliateRecord.affiliate_code
          console.log('✅ DB fallback found affiliate code:', effectiveReferralCode)
        }
      }
    }

    if (effectiveReferralCode) {
      console.log('🤝 Processing affiliate referral:', effectiveReferralCode)
      
      const { data: existingCommission } = await supabase
        .from('affiliate_commissions')
        .select('id')
        .eq('referred_user_id', userId)
        .in('status', ['approved', 'paid', 'pending'])
        .limit(1)
        .maybeSingle()

      const isRepurchase = !!existingCommission

      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('id, commission_rate, repurchase_commission_rate')
        .eq('affiliate_code', effectiveReferralCode)
        .eq('status', 'active')
        .maybeSingle()

      if (affiliate) {
        if (isRepurchase) {
          const { data: repurchaseSettings } = await supabase
            .from('system_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['affiliate_repurchase_enabled', 'affiliate_repurchase_commission_rate'])

          const repurchaseConfig: Record<string, string> = {}
          repurchaseSettings?.forEach(s => {
            repurchaseConfig[s.setting_key] = s.setting_value
          })

          const repurchaseEnabled = repurchaseConfig['affiliate_repurchase_enabled'] === 'true'

          if (repurchaseEnabled) {
            const globalRate = parseFloat(repurchaseConfig['affiliate_repurchase_commission_rate'] || '5') || 5
            const repurchaseRate = affiliate.repurchase_commission_rate != null 
              ? affiliate.repurchase_commission_rate 
              : globalRate
            const commissionAmount = (packageData.price * repurchaseRate) / 100

            await supabase.from('affiliate_commissions').insert({
              affiliate_id: affiliate.id,
              purchase_id: purchaseData.id,
              referred_user_id: userId,
              purchase_amount: packageData.price,
              commission_rate: repurchaseRate,
              commission_amount: commissionAmount,
              status: 'pending',
              is_repurchase: true
            })

            console.log(`✅ Repurchase commission created: ${commissionAmount} (rate: ${repurchaseRate}%)`)
          }
        } else {
          const commissionAmount = (packageData.price * affiliate.commission_rate) / 100
          
          await supabase.from('affiliate_commissions').insert({
            affiliate_id: affiliate.id,
            purchase_id: purchaseData.id,
            referred_user_id: userId,
            purchase_amount: packageData.price,
            commission_rate: affiliate.commission_rate,
            commission_amount: commissionAmount,
            status: 'pending',
            is_repurchase: false
          })

          console.log('✅ First purchase! Affiliate commission created:', commissionAmount)
        }
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
