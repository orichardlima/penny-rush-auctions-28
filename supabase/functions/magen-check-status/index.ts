import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const VPS_MAGEN_RAW = Deno.env.get('VPS_MAGEN_URL') || 'http://76.13.162.10:3333'
const VPS_BASE_URL = VPS_MAGEN_RAW.replace(/\/(pix|pagamento).*$/, '').replace(/\/$/, '')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { txId, purchaseId } = await req.json()

    if (!txId || !purchaseId) {
      return new Response(
        JSON.stringify({ error: 'txId and purchaseId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Checking MagenPay status for txId: ${txId}, purchaseId: ${purchaseId}`)

    // Query VPS for payment status
    const statusUrl = `${VPS_BASE_URL}/pix/status/${txId}`
    console.log(`📡 GET ${statusUrl}`)

    const vpsResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    const vpsData = await vpsResponse.json()
    console.log('📨 VPS response:', JSON.stringify(vpsData))

    if (!vpsData.sucesso) {
      return new Response(
        JSON.stringify({ status: 'pending', message: 'Aguardando pagamento' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pixStatus = vpsData.dados?.status?.toLowerCase()
    console.log(`💳 PIX status: ${pixStatus}`)

    if (pixStatus !== 'paid') {
      return new Response(
        JSON.stringify({ status: pixStatus || 'pending' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Payment is PAID — process it server-side
    console.log('✅ Payment confirmed as PAID, processing...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', purchaseError)
      return new Response(
        JSON.stringify({ status: 'paid', error: 'Purchase not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Idempotency: skip if already completed
    if (purchase.payment_status === 'completed') {
      console.log('ℹ️ Purchase already completed, returning success')
      return new Response(
        JSON.stringify({ status: 'paid', already_processed: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Update bid_purchases status
    await supabase
      .from('bid_purchases')
      .update({ payment_status: 'completed' })
      .eq('id', purchase.id)

    console.log('✅ bid_purchases updated to completed')

    // 2. Credit bids to user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('bids_balance')
      .eq('user_id', purchase.user_id)
      .single()

    if (profile) {
      const newBalance = (profile.bids_balance || 0) + purchase.bids_purchased
      await supabase
        .from('profiles')
        .update({ bids_balance: newBalance })
        .eq('user_id', purchase.user_id)
      console.log(`✅ Credited ${purchase.bids_purchased} bids. New balance: ${newBalance}`)
    }

    // 3. Approve affiliate commissions
    const { data: commissions } = await supabase
      .from('affiliate_commissions')
      .select('id, affiliate_id')
      .eq('purchase_id', purchase.id)
      .eq('status', 'pending')

    if (commissions && commissions.length > 0) {
      await supabase
        .from('affiliate_commissions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('purchase_id', purchase.id)
        .eq('status', 'pending')

      for (const comm of commissions) {
        await supabase.rpc('increment_affiliate_conversions', {
          affiliate_uuid: comm.affiliate_id
        })
      }
      console.log('✅ Affiliate commissions approved')
    } else {
      // Fallback: create commission if referral exists but no commission was created
      const { data: referral } = await supabase
        .from('affiliate_referrals')
        .select('affiliate_id')
        .eq('referred_user_id', purchase.user_id)
        .eq('converted', true)
        .limit(1)
        .maybeSingle()

      if (referral) {
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id, commission_rate, repurchase_commission_rate, status, commission_balance, total_commission_earned, total_conversions')
          .eq('id', referral.affiliate_id)
          .eq('status', 'active')
          .maybeSingle()

        if (affiliate) {
          const { data: existingComm } = await supabase
            .from('affiliate_commissions')
            .select('id')
            .eq('purchase_id', purchase.id)
            .limit(1)

          if (!existingComm || existingComm.length === 0) {
            const { count: prevPurchases } = await supabase
              .from('bid_purchases')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', purchase.user_id)
              .eq('payment_status', 'completed')
              .neq('id', purchase.id)

            const isRepurchase = (prevPurchases || 0) > 0
            const rate = isRepurchase
              ? (affiliate.repurchase_commission_rate || affiliate.commission_rate)
              : affiliate.commission_rate
            const commissionAmount = purchase.amount_paid * (rate / 100)

            await supabase.from('affiliate_commissions').insert({
              affiliate_id: affiliate.id,
              purchase_id: purchase.id,
              referred_user_id: purchase.user_id,
              purchase_amount: purchase.amount_paid,
              commission_rate: rate,
              commission_amount: commissionAmount,
              is_repurchase: isRepurchase,
              status: 'approved',
              approved_at: new Date().toISOString()
            })

            await supabase
              .from('affiliates')
              .update({
                commission_balance: (affiliate.commission_balance || 0) + commissionAmount,
                total_commission_earned: (affiliate.total_commission_earned || 0) + commissionAmount,
                total_conversions: (affiliate.total_conversions || 0) + 1
              })
              .eq('id', affiliate.id)

            console.log('✅ Affiliate commission created via check-status fallback')
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ status: 'paid', processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ magen-check-status error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error', status: 'error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})