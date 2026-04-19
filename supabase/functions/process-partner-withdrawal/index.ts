import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { sendWithdrawal } from '../_shared/withdrawal-router.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== PROCESS PARTNER WITHDRAWAL START ===')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminUserId = claimsData.claims.sub
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', adminUserId)
      .single()

    if (!adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem processar pagamentos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { withdrawalId } = await req.json()
    console.log('📦 Processing withdrawal:', withdrawalId)

    const { data: withdrawal, error: wError } = await supabase
      .from('partner_withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (wError || !withdrawal) {
      return new Response(
        JSON.stringify({ error: 'Saque não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (withdrawal.status !== 'APPROVED') {
      return new Response(
        JSON.stringify({ error: `Saque com status "${withdrawal.status}" não pode ser pago. Apenas saques APPROVED.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentDetails = withdrawal.payment_details as any
    const pixKey = paymentDetails?.pix_key
    const pixKeyType = paymentDetails?.pix_key_type || 'CPF'
    const holderName = paymentDetails?.holder_name || 'Parceiro'
    const taxId = paymentDetails?.tax_id || paymentDetails?.cpf || pixKey || ''

    if (!pixKey) {
      return new Response(
        JSON.stringify({ error: 'Chave PIX não encontrada nos dados do saque' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map para VeoPag (MagenPay aceita a chave crua)
    const keyTypeMap: Record<string, string> = {
      'cpf': 'CPF', 'cnpj': 'CNPJ', 'email': 'EMAIL',
      'telefone': 'PHONE_EVP', 'phone': 'PHONE_EVP',
      'aleatoria': 'PHONE_EVP', 'random': 'PHONE_EVP',
    }
    const veopagKeyType = keyTypeMap[pixKeyType.toLowerCase()] || 'CPF'

    // UUID único por tentativa — NUNCA reutilizar (MagenPay exige)
    const externalId = crypto.randomUUID()

    console.log('💸 Sending withdrawal via router:', withdrawal.amount, 'externalId:', externalId)

    const result = await sendWithdrawal(supabase, {
      amount: withdrawal.amount,
      externalId,
      pixKey,
      pixKeyType: veopagKeyType,
      taxId,
      holderName,
      description: `Saque parceiro - Penny Rush #${withdrawalId.slice(0, 8)}`,
    })

    console.log('✅ Router result:', JSON.stringify(result))

    // Status do saque conforme retorno
    if (result.status === 'failed') {
      // Mantém APPROVED (não consome saldo) e registra falha
      await supabase.from('partner_withdrawals').update({
        payment_details: {
          ...paymentDetails,
          last_attempt_external_id: externalId,
          last_attempt_gateway: result.gateway,
          last_attempt_status: 'failed',
          last_attempt_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', withdrawalId)

      return new Response(
        JSON.stringify({ error: 'PIX rejeitado pelo gateway. Tente novamente.', gateway: result.gateway }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // success OU processing → marcar PAID (processing significa que MagenPay aceitou e está em processamento bancário)
    const isProcessing = result.status === 'processing'
    const updatedPaymentDetails = {
      ...paymentDetails,
      paid_via: `${result.gateway}_auto`,
      external_id: externalId,
      transaction_id: result.transactionId,
      gateway_status: result.status,
      ...(result.fee !== undefined ? { gateway_fee: result.fee } : {}),
    }

    const { error: updateError } = await supabase
      .from('partner_withdrawals')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        paid_by: adminUserId,
        payment_details: updatedPaymentDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId)

    if (updateError) {
      console.error('❌ Error updating withdrawal:', updateError)
      return new Response(
        JSON.stringify({ error: 'PIX enviado mas erro ao atualizar status do saque' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualiza total_withdrawn do contrato
    const { data: contractData } = await supabase
      .from('partner_contracts')
      .select('total_withdrawn')
      .eq('id', withdrawal.partner_contract_id)
      .single()

    if (contractData) {
      await supabase
        .from('partner_contracts')
        .update({
          total_withdrawn: (contractData.total_withdrawn || 0) + withdrawal.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', withdrawal.partner_contract_id)
    }

    console.log(`✅ Withdrawal PAID via ${result.gateway} (status=${result.status})`)
    console.log('=== PROCESS PARTNER WITHDRAWAL END ===')

    return new Response(
      JSON.stringify({
        success: true,
        gateway: result.gateway,
        status: result.status,
        processing: isProcessing,
        amount: withdrawal.amount,
        transaction_id: result.transactionId,
        external_id: externalId,
        fee: result.fee,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        holder_name: holderName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
