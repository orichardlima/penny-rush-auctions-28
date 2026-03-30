import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { createMagenDeposit } from '../_shared/magen-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface PartnerUpgradePaymentRequest {
  contractId: string
  newPlanId?: string
  upgradeCotas?: number
  userId: string
  userEmail: string
  userName: string
  userCpf: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PARTNER UPGRADE PAYMENT FUNCTION START (VEOPAG) ===')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { contractId, newPlanId, upgradeCotas, userId, userEmail, userName, userCpf }: PartnerUpgradePaymentRequest = await req.json()

    if (!userCpf) {
      return new Response(
        JSON.stringify({ error: 'CPF é obrigatório para gerar pagamento PIX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Buscar contrato atual
    const { data: contract, error: contractError } = await supabase
      .from('partner_contracts')
      .select('*')
      .eq('id', contractId)
      .eq('user_id', userId)
      .single()

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (contract.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: 'Só é possível fazer upgrade em contratos ativos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const progressPercentage = (contract.total_received / contract.total_cap) * 100
    if (progressPercentage >= 80) {
      return new Response(
        JSON.stringify({ error: 'Você já atingiu mais de 80% do teto atual. Aguarde o encerramento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (upgradeCotas) {
      return await processCotasUpgrade(supabase, contract, upgradeCotas, userEmail, userName, userCpf)
    } else if (newPlanId) {
      return await processPlanUpgrade(supabase, contract, newPlanId, userEmail, userName, userCpf)
    } else {
      return new Response(
        JSON.stringify({ error: 'Informe newPlanId ou upgradeCotas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processCotasUpgrade(supabase: any, contract: any, upgradeCotas: number, userEmail: string, userName: string, userCpf: string) {
  console.log('📦 Processing COTAS upgrade:', contract.cotas, '→', upgradeCotas)

  const { data: currentPlan, error: planError } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('name', contract.plan_name)
    .eq('is_active', true)
    .single()

  if (planError || !currentPlan) {
    return new Response(
      JSON.stringify({ error: 'Plano atual não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (upgradeCotas <= contract.cotas) {
    return new Response(
      JSON.stringify({ error: 'Só é possível aumentar o número de cotas' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (upgradeCotas > (currentPlan.max_cotas || 1)) {
    return new Response(
      JSON.stringify({ error: `O plano ${currentPlan.display_name} permite no máximo ${currentPlan.max_cotas} cotas` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const cotasDiff = upgradeCotas - contract.cotas
  const differenceToPay = currentPlan.aporte_value * cotasDiff
  const externalReference = `cotas-upgrade:${contract.id}:${upgradeCotas}`

  const depositResult = await createMagenDeposit({
    amount: differenceToPay,
    txId: externalReference,
    description: `Upgrade de Cotas: ${contract.plan_name} ${contract.cotas} → ${upgradeCotas} cotas`,
    payerName: userName || 'Usuario',
    payerTaxId: userCpf
  })

  const newAporteValue = currentPlan.aporte_value * upgradeCotas
  const newTotalCap = currentPlan.total_cap * upgradeCotas
  const newWeeklyCap = currentPlan.weekly_cap * upgradeCotas

  const response = {
    paymentId: depositResult.transactionId,
    qrCodeBase64: depositResult.qrCodeBase64,
    pixCopyPaste: null,
    status: depositResult.status,
    contractId: contract.id,
    previousPlanName: contract.plan_name,
    newPlanName: contract.plan_name,
    differenceToPay,
    newAporteValue,
    newTotalCap,
    newWeeklyCap,
    isCotasUpgrade: true,
    previousCotas: contract.cotas,
    newCotas: upgradeCotas
  }

  console.log('✅ Cotas upgrade payment response ready')
  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function processPlanUpgrade(supabase: any, contract: any, newPlanId: string, userEmail: string, userName: string, userCpf: string) {
  const { data: newPlan, error: planError } = await supabase
    .from('partner_plans')
    .select('*')
    .eq('id', newPlanId)
    .eq('is_active', true)
    .single()

  if (planError || !newPlan) {
    return new Response(
      JSON.stringify({ error: 'Plano não encontrado ou inativo' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (newPlan.aporte_value <= contract.aporte_value) {
    return new Response(
      JSON.stringify({ error: 'Só é possível fazer upgrade para um plano superior' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const differenceToPay = newPlan.aporte_value - contract.aporte_value
  const externalReference = `upgrade:${contract.id}:${newPlanId}`

  const depositResult = await createMagenDeposit({
    amount: differenceToPay,
    txId: externalReference,
    description: `Upgrade de Parceria: ${contract.plan_name} → ${newPlan.display_name}`,
    payerName: userName || 'Usuario',
    payerTaxId: userCpf
  })

  const response = {
    paymentId: depositResult.transactionId,
    qrCodeBase64: depositResult.qrCodeBase64,
    pixCopyPaste: null,
    status: depositResult.status,
    contractId: contract.id,
    previousPlanName: contract.plan_name,
    newPlanName: newPlan.display_name,
    differenceToPay: differenceToPay,
    newAporteValue: newPlan.aporte_value,
    newTotalCap: newPlan.total_cap,
    newWeeklyCap: newPlan.weekly_cap
  }

  console.log('✅ Partner upgrade payment response ready')
  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
