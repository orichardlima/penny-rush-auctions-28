import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { createVeopagDeposit } from '../_shared/veopag-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface PaymentRequest {
  packageId: string
  userId: string
  userEmail: string
  userName: string
  userCpf: string
  referralCode?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== VEOPAG PAYMENT FUNCTION START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // 5. Criar cobrança VeoPag
    const depositResult = await createVeopagDeposit({
      amount: packageData.price,
      external_id: purchaseData.id,
      description: `${packageData.name} - ${finalBidsCount} lances`,
      payer: {
        name: userName || 'Usuario',
        email: userEmail,
        document: userCpf
      }
    })

    // 6. Atualizar compra com dados do pagamento
    await supabase
      .from('bid_purchases')
      .update({
        payment_id: depositResult.transactionId,
        external_reference: purchaseData.id
      })
      .eq('id', purchaseData.id)

    // 7. Retornar dados para o frontend
    const response = {
      purchaseId: purchaseData.id,
      paymentId: depositResult.transactionId,
      qrCodeBase64: depositResult.qrCodeBase64,
      qrCodeUrl: depositResult.qrCodeUrl,
      pixCopyPaste: null,
      status: depositResult.status,
      promoApplied,
      finalBidsCount
    }

    console.log('✅ Payment response ready')

    // 8. Processar comissão de afiliado
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
