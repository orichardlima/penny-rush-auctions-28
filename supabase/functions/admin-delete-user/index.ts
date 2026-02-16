import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify requesting user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, full_name')
      .eq('user_id', caller.id)
      .single();

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get target user info for audit log
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', userId)
      .single();

    if (!targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ADMIN-DELETE] Starting deletion of user ${userId} (${targetProfile.email}) by admin ${caller.id}`);

    // Get affiliate IDs for this user
    const { data: affiliates } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .eq('user_id', userId);
    const affiliateIds = (affiliates || []).map(a => a.id);

    // Get partner contract IDs for this user
    const { data: contracts } = await supabaseAdmin
      .from('partner_contracts')
      .select('id')
      .eq('user_id', userId);
    const contractIds = (contracts || []).map(c => c.id);

    // Delete in order respecting foreign keys
    // 1. Bids
    await supabaseAdmin.from('bids').delete().eq('user_id', userId);

    // 2. Bid purchases
    await supabaseAdmin.from('bid_purchases').delete().eq('user_id', userId);

    // 3. Orders
    await supabaseAdmin.from('orders').delete().eq('winner_id', userId);

    // 4-7. Affiliate related (if any)
    if (affiliateIds.length > 0) {
      for (const aid of affiliateIds) {
        await supabaseAdmin.from('affiliate_commissions').delete().eq('affiliate_id', aid);
        await supabaseAdmin.from('affiliate_referrals').delete().eq('affiliate_id', aid);
        await supabaseAdmin.from('affiliate_withdrawals').delete().eq('affiliate_id', aid);
        await supabaseAdmin.from('affiliate_cpa_goals').delete().eq('affiliate_id', aid);
      }
      // 8. Affiliates
      await supabaseAdmin.from('affiliates').delete().eq('user_id', userId);
    }

    // 9. Partner referral bonuses (as referred user)
    await supabaseAdmin.from('partner_referral_bonuses').delete().eq('referred_user_id', userId);

    // 10. Partner related (if any)
    if (contractIds.length > 0) {
      for (const cid of contractIds) {
        await supabaseAdmin.from('ad_center_completions').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('partner_referral_bonuses').delete().eq('referrer_contract_id', cid);
        await supabaseAdmin.from('partner_referral_bonuses').delete().eq('referred_contract_id', cid);
        await supabaseAdmin.from('partner_early_terminations').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('partner_upgrades').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('partner_withdrawals').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('partner_payouts').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('partner_manual_credits').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('fast_start_achievements').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('binary_bonuses').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('binary_points_log').delete().eq('partner_contract_id', cid);
        await supabaseAdmin.from('binary_points_log').delete().eq('source_contract_id', cid);
        // Binary positions: clear references first
        await supabaseAdmin.from('partner_binary_positions').update({ left_child_id: null }).eq('left_child_id', cid);
        await supabaseAdmin.from('partner_binary_positions').update({ right_child_id: null }).eq('right_child_id', cid);
        await supabaseAdmin.from('partner_binary_positions').update({ parent_contract_id: null }).eq('parent_contract_id', cid);
        await supabaseAdmin.from('partner_binary_positions').update({ sponsor_contract_id: null }).eq('sponsor_contract_id', cid);
        await supabaseAdmin.from('partner_binary_positions').update({ pending_position_for: null }).eq('pending_position_for', cid);
        await supabaseAdmin.from('partner_binary_positions').delete().eq('partner_contract_id', cid);
      }
      // Delete contracts
      await supabaseAdmin.from('partner_contracts').delete().eq('user_id', userId);
    }

    // 11. Referral bonuses (as referrer or referred in the general table)
    await supabaseAdmin.from('referral_bonuses').delete().eq('referrer_user_id', userId);
    await supabaseAdmin.from('referral_bonuses').delete().eq('referred_user_id', userId);

    // 12. Log the action BEFORE deleting the profile (since audit log needs admin context)
    await supabaseAdmin.from('admin_audit_log').insert({
      admin_user_id: caller.id,
      admin_name: callerProfile.full_name || 'Admin',
      action_type: 'user_deleted',
      target_type: 'user',
      target_id: userId,
      description: `Usuário deletado permanentemente: ${targetProfile.full_name || 'N/A'} (${targetProfile.email || 'N/A'})`,
      old_values: { full_name: targetProfile.full_name, email: targetProfile.email },
      new_values: null
    });

    // 13. Delete profile
    await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

    // 14. Delete from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error(`[ADMIN-DELETE] Error deleting auth user: ${deleteAuthError.message}`);
      // Profile already deleted, log the partial failure
      return new Response(JSON.stringify({ 
        success: true, 
        warning: `User data deleted but auth account removal failed: ${deleteAuthError.message}` 
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ADMIN-DELETE] ✅ User ${userId} fully deleted by admin ${caller.id}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[ADMIN-DELETE] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
