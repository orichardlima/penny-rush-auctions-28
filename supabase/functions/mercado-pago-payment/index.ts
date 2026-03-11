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
  referralCode?: string
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
    const { packageId, userId, userEmail, userName, referralCode }: PaymentRequest = await req.json()

    console.log('📦 Request data:', { packageId, userId, userEmail, userName, referralCode })

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

      // Verificar se promoção está ativa e válida
      const isExpired = promoExpires && new Date(promoExpires) < new Date()
      const isPromoValid = promoEnabled && !isExpired

      if (isPromoValid && multiplierValue > 1) {
        promoMultiplier = multiplierValue
        promoApplied = true
        console.log(`🎉 Promoção ativa! Multiplicador: ${promoMultiplier}x, Modo: ${promoMode}`)
      } else {
        console.log('ℹ️ Nenhuma promoção ativa ou válida')
      }
    }

    // 3. Calcular lances finais com promoção baseado no modo
    const baseBidsFromPrice = Math.floor(packageData.price)
    const totalBidsFromPackage = packageData.bids_count
    let finalBidsCount = totalBidsFromPackage

    if (promoApplied) {
      switch (promoMode) {
        case 'base':
          // Multiplica apenas o preço base
          finalBidsCount = Math.floor(baseBidsFromPrice * promoMultiplier)
          break
        case 'total':
          // Multiplica o total do pacote
          finalBidsCount = Math.floor(totalBidsFromPackage * promoMultiplier)
          break
        case 'bonus':
          // Total + (base × (multiplicador - 1))
          const bonusBids = Math.floor(baseBidsFromPrice * (promoMultiplier - 1))
          finalBidsCount = totalBidsFromPackage + bonusBids
          break
        default:
          finalBidsCount = Math.floor(baseBidsFromPrice * promoMultiplier)
      }
    }
    
    console.log(`📊 Lances: base=${baseBidsFromPrice}, multiplicador=${promoMultiplier}, final=${finalBidsCount}`)

    // 4. Criar pedido de compra no banco (status pending) com lances multiplicados
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('bid_purchases')
      .insert({
        user_id: userId,
        package_id: packageId,
        bids_purchased: finalBidsCount, // Lances já multiplicados
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

    console.log('✅ Purchase created:', purchaseData.id, `(${finalBidsCount} lances)`)

    // 5. Criar pagamento no Mercado Pago
    const descriptionSuffix = promoApplied ? ` (${promoMultiplier}x PROMO)` : ''
    const paymentPayload = {
      transaction_amount: packageData.price,
      description: `${packageData.name} - ${finalBidsCount} lances${descriptionSuffix}`,
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

    // 6. Atualizar compra com dados do pagamento
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

    // 7. Retornar dados para o frontend
    const response = {
      purchaseId: purchaseData.id,
      paymentId: mpData.id,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      pixCopyPaste: mpData.point_of_interaction?.transaction_data?.qr_code,
      status: mpData.status,
      promoApplied,
      finalBidsCount
    }

    console.log('✅ Payment response ready:', response)

    // 8. Processar comissão de afiliado (1ª compra ou recompra)
    // Determinar o código de referral: do frontend OU fallback do banco de dados
    let effectiveReferralCode = referralCode || null

    if (!effectiveReferralCode) {
      // Fallback: buscar na tabela affiliate_referrals se o usuário tem um afiliado vinculado
      console.log('🔍 No referralCode from frontend, checking affiliate_referrals for userId:', userId)
      
      const { data: referralRecord } = await supabase
        .from('affiliate_referrals')
        .select('affiliate_id')
        .eq('referred_user_id', userId)
        .eq('converted', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (referralRecord) {
        // Buscar o affiliate_code do afiliado encontrado
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

      if (!effectiveReferralCode) {
        console.log('ℹ️ No affiliate referral found in DB either')
      }
    }

    if (effectiveReferralCode) {
      console.log('🤝 Processing affiliate referral:', effectiveReferralCode)
      
      // Checar se este usuário já gerou comissão anteriormente
      const { data: existingCommission, error: checkError } = await supabase
        .from('affiliate_commissions')
        .select('id')
        .eq('referred_user_id', userId)
        .in('status', ['approved', 'paid', 'pending'])
        .limit(1)
        .maybeSingle()

      if (checkError) {
        console.error('❌ Error checking existing commission:', checkError)
      }

      const isRepurchase = !!existingCommission

      // Buscar afiliado
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('id, commission_rate, repurchase_commission_rate')
        .eq('affiliate_code', effectiveReferralCode)
        .eq('status', 'active')
        .maybeSingle()

      if (affiliate) {
        if (isRepurchase) {
          // RECOMPRA - verificar se recurso está habilitado
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
            // Taxa individual do afiliado OU taxa global
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
          } else {
            console.log('ℹ️ Repurchase commissions disabled, skipping')
          }
        } else {
          // PRIMEIRA COMPRA - comportamento original
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
      } else {
        console.log('⚠️ Affiliate not found or inactive for code:', effectiveReferralCode)
      }
    }

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
