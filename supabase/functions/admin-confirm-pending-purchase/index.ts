import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: claimData, error: claimErr } = await supabase.auth.getClaims(token)
    if (claimErr || !claimData?.claims?.sub) {
      return jsonResponse({ error: 'Invalid token' }, 401)
    }
    const adminUserId = claimData.claims.sub as string

    // Validate admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, full_name')
      .eq('user_id', adminUserId)
      .maybeSingle()

    if (!profile?.is_admin) {
      return jsonResponse({ error: 'Forbidden — admin only' }, 403)
    }

    const body = await req.json()
    const { purchase_id, justification, payment_reference } = body

    if (!purchase_id || typeof purchase_id !== 'string') {
      return jsonResponse({ error: 'purchase_id é obrigatório' }, 400)
    }
    if (!justification || typeof justification !== 'string' || justification.trim().length < 20) {
      return jsonResponse({ error: 'Justificativa obrigatória (mínimo 20 caracteres)' }, 400)
    }

    // Load purchase
    const { data: purchase, error: purchaseErr } = await supabase
      .from('bid_purchases')
      .select('*')
      .eq('id', purchase_id)
      .maybeSingle()

    if (purchaseErr || !purchase) {
      return jsonResponse({ error: 'Compra não encontrada' }, 404)
    }

    if (purchase.payment_status === 'completed') {
      return jsonResponse({ error: 'Compra já está concluída' }, 400)
    }

    // Update purchase status
    await supabase
      .from('bid_purchases')
      .update({ payment_status: 'completed' })
      .eq('id', purchase_id)

    // Credit bids
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('bids_balance, full_name')
      .eq('user_id', purchase.user_id)
      .single()

    const oldBalance = userProfile?.bids_balance || 0
    const newBalance = oldBalance + purchase.bids_purchased

    await supabase
      .from('profiles')
      .update({ bids_balance: newBalance })
      .eq('user_id', purchase.user_id)

    // Approve pending commissions
    const { data: commissions } = await supabase
      .from('affiliate_commissions')
      .select('id, affiliate_id')
      .eq('purchase_id', purchase_id)
      .eq('status', 'pending')

    if (commissions && commissions.length > 0) {
      await supabase
        .from('affiliate_commissions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('purchase_id', purchase_id)
        .eq('status', 'pending')

      for (const comm of commissions) {
        await supabase.rpc('increment_affiliate_conversions', { affiliate_uuid: comm.affiliate_id })
      }
    } else {
      // Fallback: create commission if affiliate referral exists
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
        }
      }
    }

    // Audit log
    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUserId,
      admin_name: profile.full_name || 'Admin',
      action_type: 'manual_purchase_confirmation',
      target_type: 'bid_purchase',
      target_id: purchase_id,
      old_values: {
        payment_status: purchase.payment_status,
        bids_balance: oldBalance,
      },
      new_values: {
        payment_status: 'completed',
        bids_balance: newBalance,
        bids_credited: purchase.bids_purchased,
        amount_paid: purchase.amount_paid,
        payment_reference: payment_reference || null,
      },
      description: `Confirmação manual de compra — ${userProfile?.full_name || 'usuário'} (+${purchase.bids_purchased} lances). Justificativa: ${justification.trim()}`,
    })

    return jsonResponse({
      success: true,
      bids_credited: purchase.bids_purchased,
      new_balance: newBalance,
      user_name: userProfile?.full_name,
    }, 200)

  } catch (error) {
    console.error('admin-confirm-pending-purchase error:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
