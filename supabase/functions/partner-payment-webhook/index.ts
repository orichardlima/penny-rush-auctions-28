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

    const externalReference = paymentData.external_reference || ''

    // 2. Verificar se é um pagamento de UPGRADE
    if (externalReference.startsWith('upgrade:')) {
      console.log('🔄 Processing UPGRADE payment')
      return await processUpgradePayment(supabase, paymentData, externalReference)
    }

    // 3. Caso contrário, é pagamento de NOVO CONTRATO
    console.log('🆕 Processing NEW CONTRACT payment')
    return await processNewContractPayment(supabase, paymentData, paymentId)

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})

// Processar pagamento de NOVO CONTRATO
async function processNewContractPayment(supabase: any, paymentData: any, paymentId: string) {
  // Buscar contrato pelo payment_id
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

  // Processar baseado no status do pagamento
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

    // Creditar bônus de lances se o plano tiver
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

    // Bônus de indicação em cascata é criado automaticamente pelo trigger
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
}

// Processar pagamento de UPGRADE
async function processUpgradePayment(supabase: any, paymentData: any, externalReference: string) {
  // Formato: upgrade:contractId:newPlanId
  const parts = externalReference.split(':')
  if (parts.length !== 3) {
    console.error('❌ Invalid upgrade external_reference format:', externalReference)
    return new Response('Invalid reference', { status: 400, headers: corsHeaders })
  }

  const contractId = parts[1]
  const newPlanId = parts[2]

  console.log('📄 Upgrade details - Contract:', contractId, 'New Plan:', newPlanId)

  // Buscar contrato
  const { data: contract, error: contractError } = await supabase
    .from('partner_contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (contractError || !contract) {
    console.error('❌ Contract not found for upgrade:', contractError)
    return new Response('Contract not found', { status: 404, headers: corsHeaders })
  }

  // Buscar novo plano
  const { data: newPlan, error: planError } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('id', newPlanId)
    .single()

  if (planError || !newPlan) {
    console.error('❌ New plan not found for upgrade:', planError)
    return new Response('Plan not found', { status: 404, headers: corsHeaders })
  }

  if (paymentData.status === 'approved') {
    console.log('✅ Upgrade payment approved, applying upgrade')

    const differencePaid = newPlan.aporte_value - contract.aporte_value

    // 1. Registrar o upgrade na tabela de auditoria
    const { error: upgradeError } = await supabase
      .from('partner_upgrades')
      .insert({
        partner_contract_id: contract.id,
        previous_plan_name: contract.plan_name,
        previous_aporte_value: contract.aporte_value,
        previous_weekly_cap: contract.weekly_cap,
        previous_total_cap: contract.total_cap,
        new_plan_name: newPlan.name,
        new_aporte_value: newPlan.aporte_value,
        new_weekly_cap: newPlan.weekly_cap,
        new_total_cap: newPlan.total_cap,
        total_received_at_upgrade: contract.total_received,
        difference_paid: differencePaid,
        notes: `Pagamento PIX ID: ${paymentData.id}`
      })

    if (upgradeError) {
      console.error('❌ Failed to insert upgrade record:', upgradeError)
    } else {
      console.log('✅ Upgrade record created')
    }

    // 2. Atualizar o contrato com novo plano
    const { error: updateError } = await supabase
      .from('partner_contracts')
      .update({
        plan_name: newPlan.name,
        aporte_value: newPlan.aporte_value,
        weekly_cap: newPlan.weekly_cap,
        total_cap: newPlan.total_cap,
        updated_at: new Date().toISOString()
      })
      .eq('id', contract.id)

    if (updateError) {
      console.error('❌ Failed to update contract with upgrade:', updateError)
      return new Response('Update failed', { status: 500, headers: corsHeaders })
    }

    console.log('✅ Contract upgraded successfully:', contract.plan_name, '→', newPlan.name)
    console.log('=== PARTNER UPGRADE PAYMENT WEBHOOK END ===')
    
  } else if (paymentData.status === 'cancelled' || paymentData.status === 'rejected') {
    console.log('❌ Upgrade payment cancelled/rejected - no changes made')
  } else if (paymentData.status === 'pending') {
    console.log('ℹ️ Upgrade payment still pending')
  }

  return new Response('OK', { status: 200, headers: corsHeaders })
}
