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

    // 2. Update withdrawal to PAID (manual flow)
    const paymentDetails = withdrawal.payment_details as any
    const updatedPaymentDetails = {
      ...paymentDetails,
      paid_via: 'manual'
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
        JSON.stringify({ error: 'Erro ao atualizar status do saque' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Update contract total_withdrawn
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

    console.log('✅ Withdrawal marked as PAID (manual)')
    console.log('=== PROCESS PARTNER WITHDRAWAL END ===')

    return new Response(
      JSON.stringify({
        success: true,
        amount: withdrawal.amount,
        pix_key: paymentDetails?.pix_key || null,
        pix_key_type: paymentDetails?.pix_key_type || null,
        holder_name: paymentDetails?.holder_name || null
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
