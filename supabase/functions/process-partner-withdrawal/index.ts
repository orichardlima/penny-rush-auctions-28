import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

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
    const mercadoPagoAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    if (!mercadoPagoAccessToken) {
      console.error('❌ MERCADO_PAGO_ACCESS_TOKEN não configurado')
      return new Response(
        JSON.stringify({ error: 'Mercado Pago não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // 2. Extract PIX details
    const paymentDetails = withdrawal.payment_details as any
    const pixKey = paymentDetails?.pix_key
    const pixKeyType = paymentDetails?.pix_key_type

    if (!pixKey || !pixKeyType) {
      return new Response(
        JSON.stringify({ error: 'Dados PIX incompletos no saque (chave ou tipo ausente)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Map PIX key type to Mercado Pago format
    const pixKeyTypeMap: Record<string, string> = {
      'cpf': 'CPF',
      'cnpj': 'CNPJ',
      'email': 'EMAIL',
      'phone': 'PHONE',
      'random': 'EVP'
    }

    const mpPixKeyType = pixKeyTypeMap[pixKeyType]
    if (!mpPixKeyType) {
      return new Response(
        JSON.stringify({ error: `Tipo de chave PIX "${pixKeyType}" não suportado` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Send PIX via Mercado Pago Disbursements API
    const idempotencyKey = `withdrawal-${withdrawalId}-${Date.now()}`

    const mpPayload = {
      amount: withdrawal.amount,
      external_reference: `withdrawal:${withdrawalId}`,
      description: `Saque parceiro - ${paymentDetails?.holder_name || 'N/A'}`,
      point_of_interaction: {
        type: "PIX_TRANSFER",
        transaction_data: {
          first_time_use: false
        }
      },
      payment_method_id: "pix_transfer",
      receiver: {
        id: pixKey
      }
    }

    // Use the Payouts API (transaction-intents/process) for sending PIX
    console.log('💳 Sending PIX payout via Mercado Pago:', { amount: withdrawal.amount, pixKey, pixKeyType: mpPixKeyType })

    const mpResponse = await fetch('https://api.mercadopago.com/v1/transaction-intents/process', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadoPagoAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
        'x-enforce-signature': 'false'
      },
      body: JSON.stringify({
        external_reference: `withdrawal:${withdrawalId}`,
        point_of_interaction: {
          type: "PSP_TRANSFER"
        },
        transaction: {
          from: {
            accounts: [
              {
                amount: withdrawal.amount
              }
            ]
          },
          to: {
            accounts: [
              {
                amount: withdrawal.amount,
                bank_id: "0",
                type: "current",
                number: "0",
                owner: {
                  identification: {
                    type: mpPixKeyType,
                    number: pixKey
                  }
                }
              }
            ]
          },
          total_amount: withdrawal.amount,
          statement_descriptor: `Saque parceiro`
        }
      })
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('❌ Mercado Pago API error:', JSON.stringify(mpData))
      
      let errorMessage = 'Erro ao enviar PIX via Mercado Pago'
      if (mpData?.message) {
        errorMessage = mpData.message
      } else if (mpData?.cause?.[0]?.description) {
        errorMessage = mpData.cause[0].description
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          mp_error: mpData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Mercado Pago payment created:', mpData.id, 'Status:', mpData.status)

    // 5. Update withdrawal to PAID with transaction details
    const updatedPaymentDetails = {
      ...paymentDetails,
      mp_transaction_id: mpData.id,
      mp_status: mpData.status,
      mp_status_detail: mpData.status_detail,
      paid_via: 'mercado_pago_api'
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
      // PIX was sent but DB update failed - log this critical issue
      return new Response(
        JSON.stringify({ 
          error: 'PIX enviado mas erro ao atualizar status no banco. ID da transação MP: ' + mpData.id,
          mp_transaction_id: mpData.id,
          warning: 'CRITICAL: Payment was sent but status not updated'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Update contract total_withdrawn
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

    console.log('✅ Withdrawal processed successfully')
    console.log('=== PROCESS PARTNER WITHDRAWAL END ===')

    return new Response(
      JSON.stringify({
        success: true,
        mp_transaction_id: mpData.id,
        mp_status: mpData.status,
        amount: withdrawal.amount
      }),
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
