import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PARTNER PAYMENT WEBHOOK START ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const body = await req.json()
    console.log('📨 Webhook payload:', body)

    // Verificar se é notificação de pagamento
    if (body.type !== 'payment') {
      console.log('ℹ️ Not a payment notification, ignoring')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      console.log('❌ No payment ID in webhook')
      return new Response('No payment ID', { status: 400, headers: corsHeaders })
    }

    console.log('💳 Processing payment ID:', paymentId)

    // 1. Buscar dados do pagamento no Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mercadoPagoAccessToken}`
      }
    })

    if (!mpResponse.ok) {
      console.error('❌ Failed to fetch payment from Mercado Pago')
      return new Response('Payment fetch failed', { status: 400, headers: corsHeaders })
    }

    const paymentData = await mpResponse.json()
    console.log('📦 Payment data:', {
      id: paymentData.id,
      status: paymentData.status,
      external_reference: paymentData.external_reference
    })

    // 2. Buscar contrato pelo payment_id
    const { data: contract, error: contractError } = await supabase
      .from('partner_contracts')
      .select('*')
      .eq('payment_id', paymentId.toString())
      .single()

    if (contractError || !contract) {
      console.error('❌ Contract not found:', contractError)
      return new Response('Contract not found', { status: 404, headers: corsHeaders })
    }

    console.log('📄 Contract found:', contract.id, 'current status:', contract.status, 'payment_status:', contract.payment_status)

    // 3. Processar baseado no status do pagamento
    if (paymentData.status === 'approved' && contract.payment_status !== 'completed') {
      console.log('✅ Payment approved, activating contract')
      
      // Buscar dados do plano para bônus de lances
      const { data: planData } = await supabase
        .from('partner_plans')
        .select('bonus_bids')
        .eq('name', contract.plan_name)
        .maybeSingle()

      // Atualizar status do contrato para ACTIVE
      const { error: updateError } = await supabase
        .from('partner_contracts')
        .update({ 
          status: 'ACTIVE',
          payment_status: 'completed'
        })
        .eq('id', contract.id)

      if (updateError) {
        console.error('❌ Failed to update contract:', updateError)
        return new Response('Update failed', { status: 500, headers: corsHeaders })
      }

      console.log('✅ Contract activated successfully')

      // 4. Creditar bônus de lances se o plano tiver
      const bonusBids = planData?.bonus_bids || 0
      if (bonusBids > 0) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('bids_balance')
          .eq('user_id', contract.user_id)
          .single()

        if (!profileError && profile) {
          const newBalance = (profile.bids_balance || 0) + bonusBids
          
          const { error: balanceError } = await supabase
            .from('profiles')
            .update({ bids_balance: newBalance })
            .eq('user_id', contract.user_id)

          if (!balanceError) {
            // Atualizar o contrato com o bônus recebido
            await supabase
              .from('partner_contracts')
              .update({ bonus_bids_received: bonusBids })
              .eq('id', contract.id)

            console.log('✅ Bonus bids credited:', bonusBids)
          } else {
            console.error('❌ Failed to credit bonus bids:', balanceError)
          }
        }
      }

      // 5. Bônus de indicação em cascata é criado automaticamente pelo trigger
      // create_cascade_referral_bonuses no banco de dados
      console.log('ℹ️ Cascade referral bonuses will be created by database trigger')

      console.log('✅ Partner contract activation completed successfully')
      
    } else if (paymentData.status === 'cancelled' || paymentData.status === 'rejected') {
      console.log('❌ Payment cancelled/rejected, updating contract')
      
      await supabase
        .from('partner_contracts')
        .update({ 
          status: 'SUSPENDED',
          payment_status: 'failed'
        })
        .eq('id', contract.id)

      console.log('✅ Contract marked as suspended/failed')
    } else if (paymentData.status === 'pending') {
      console.log('ℹ️ Payment still pending, no action needed')
    }

    console.log('=== PARTNER PAYMENT WEBHOOK END ===')
    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})
