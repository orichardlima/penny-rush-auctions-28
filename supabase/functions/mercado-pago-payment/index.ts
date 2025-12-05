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
        'promo_multiplier_expires_at'
      ])

    let promoMultiplier = 1
    let promoApplied = false

    if (!promoError && promoSettings) {
      const settings: Record<string, string> = {}
      promoSettings.forEach(s => {
        settings[s.setting_key] = s.setting_value
      })

      const promoEnabled = settings['promo_multiplier_enabled'] === 'true'
      const promoExpires = settings['promo_multiplier_expires_at'] || ''
      const multiplierValue = parseFloat(settings['promo_multiplier_value'] || '1') || 1

      // Verificar se promoção está ativa e válida
      const isExpired = promoExpires && new Date(promoExpires) < new Date()
      const isPromoValid = promoEnabled && !isExpired

      if (isPromoValid && multiplierValue > 1) {
        promoMultiplier = multiplierValue
        promoApplied = true
        console.log(`🎉 Promoção ativa! Multiplicador: ${promoMultiplier}x`)
      } else {
        console.log('ℹ️ Nenhuma promoção ativa ou válida')
      }
    }

    // 3. Calcular lances finais com promoção
    const baseBids = packageData.bids_count
    const finalBidsCount = Math.floor(baseBids * promoMultiplier)
    
    console.log(`📊 Lances: base=${baseBids}, multiplicador=${promoMultiplier}, final=${finalBidsCount}`)

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

    // 8. Se tem código de referral, verificar se é primeira compra do indicado
    if (referralCode) {
      console.log('🤝 Processing affiliate referral:', referralCode)
      
      // 🆕 VERIFICAÇÃO: Checar se este usuário já gerou comissão anteriormente
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

      if (existingCommission) {
        console.log('ℹ️ User already generated commission before (ID: ' + existingCommission.id + '), skipping affiliate reward')
        // NÃO criar comissão - usuário já foi convertido anteriormente
      } else {
        // Usuário é NOVO - criar comissão normalmente
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id, commission_rate')
          .eq('affiliate_code', referralCode)
          .eq('status', 'active')
          .maybeSingle()

        if (affiliate) {
          const commissionAmount = (packageData.price * affiliate.commission_rate) / 100
          
          await supabase.from('affiliate_commissions').insert({
            affiliate_id: affiliate.id,
            purchase_id: purchaseData.id,
            referred_user_id: userId,
            purchase_amount: packageData.price,
            commission_rate: affiliate.commission_rate,
            commission_amount: commissionAmount,
            status: 'pending'
          })

          console.log('✅ First purchase! Affiliate commission created:', commissionAmount)
        } else {
          console.log('⚠️ Affiliate not found or inactive for code:', referralCode)
        }
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
