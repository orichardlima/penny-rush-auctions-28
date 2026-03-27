import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'
import { createVeopagWithdrawal } from '../_shared/veopag-auth.ts'

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

    // Validate admin auth
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

    // Verify user is admin
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

    // 1. Fetch withdrawal
    const { data: withdrawal, error: wError } = await supabase
      .from('partner_withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (wError || !withdrawal) {
      console.error('❌ Withdrawal not found:', wError)
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

    // 2. Extract payment details
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

    // Map pix_key_type to VeoPag key_type
    const keyTypeMap: Record<string, string> = {
      'cpf': 'CPF',
      'cnpj': 'CNPJ',
      'email': 'EMAIL',
      'telefone': 'PHONE_EVP',
      'phone': 'PHONE_EVP',
      'aleatoria': 'PHONE_EVP',
      'random': 'PHONE_EVP',
    }
    const veopagKeyType = keyTypeMap[pixKeyType.toLowerCase()] || 'CPF'

    // 3. Call VeoPag to send PIX
    console.log('💸 Sending PIX via VeoPag:', withdrawal.amount, 'to', pixKey)
    
    const veopagResult = await createVeopagWithdrawal({
      amount: withdrawal.amount,
      external_id: `withdrawal:${withdrawalId}`,
      pix_key: pixKey,
      key_type: veopagKeyType as any,
      taxId: taxId,
      name: holderName,
      description: `Saque parceiro - Penny Rush #${withdrawalId.slice(0, 8)}`
    })

    console.log('✅ VeoPag withdrawal result:', JSON.stringify(veopagResult))

    // 4. Update withdrawal to PAID
    const updatedPaymentDetails = {
      ...paymentDetails,
      paid_via: 'veopag_auto',
      veopag_transaction_id: veopagResult.transaction_id,
      veopag_status: veopagResult.status,
      veopag_fee: veopagResult.fee
    }

    const { error: updateError } = await supabase
      .from('partner_withdrawals')
      .update({
        status: 'PAID',
        paid_at: new Date().toISOString(),
        paid_by: adminUserId,
        payment_details: updatedPaymentDetails,
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawalId)

    if (updateError) {
      console.error('❌ Error updating withdrawal:', updateError)
      return new Response(
        JSON.stringify({ error: 'PIX enviado mas erro ao atualizar status do saque' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Update contract total_withdrawn
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
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawal.partner_contract_id)
    }

    console.log('✅ Withdrawal PAID via VeoPag auto-PIX')
    console.log('=== PROCESS PARTNER WITHDRAWAL END ===')

    return new Response(
      JSON.stringify({
        success: true,
        amount: withdrawal.amount,
        transaction_id: veopagResult.transaction_id,
        fee: veopagResult.fee,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        holder_name: holderName
      }),
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