import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

interface PartnerUpgradePaymentRequest {
  contractId: string
  newPlanId: string
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
    console.log('=== PARTNER UPGRADE PAYMENT FUNCTION START (ASAAS) ===')
    
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
    const { contractId, newPlanId, userId, userEmail, userName, userCpf }: PartnerUpgradePaymentRequest = await req.json()

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

    // 2. Validar contrato ativo
    if (contract.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ error: 'Só é possível fazer upgrade em contratos ativos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Validar progresso < 80%
    const progressPercentage = (contract.total_received / contract.total_cap) * 100
    if (progressPercentage >= 80) {
      return new Response(
        JSON.stringify({ error: 'Você já atingiu mais de 80% do teto atual. Aguarde o encerramento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Buscar novo plano
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

    // 5. Validar plano superior
    if (newPlan.aporte_value <= contract.aporte_value) {
      return new Response(
        JSON.stringify({ error: 'Só é possível fazer upgrade para um plano superior' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const differenceToPay = newPlan.aporte_value - contract.aporte_value
    console.log('💰 Difference to pay:', differenceToPay)

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
    const externalReference = `upgrade:${contractId}:${newPlanId}`

    const chargeRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'access_token': asaasApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: differenceToPay,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Upgrade de Parceria: ${contract.plan_name} → ${newPlan.display_name}`,
        externalReference: externalReference
      })
    })
    const chargeData = await chargeRes.json()

    if (!chargeRes.ok) {
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

    const response = {
      paymentId: chargeData.id,
      qrCode: qrData.payload,
      qrCodeBase64: qrData.encodedImage,
      pixCopyPaste: qrData.payload,
      status: chargeData.status,
      contractId: contractId,
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

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
