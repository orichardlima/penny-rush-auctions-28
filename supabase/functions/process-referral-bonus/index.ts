import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReferralBonusRequest {
  purchase_id: string;
  referred_user_id: string;
  package_value: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { purchase_id, referred_user_id, package_value }: ReferralBonusRequest = await req.json();

    console.log(`[Referral Bonus] Processing for user ${referred_user_id}, purchase ${purchase_id}, value R$ ${package_value}`);

    // Check if bonus already processed for this purchase
    const { data: existingBonus } = await supabase
      .from('referral_bonuses')
      .select('id')
      .eq('purchase_id', purchase_id)
      .single();

    if (existingBonus) {
      console.log(`[Referral Bonus] Already processed for purchase ${purchase_id}`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Bonus already processed for this purchase'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find the referrer from affiliate_referrals
    const { data: referral } = await supabase
      .from('affiliate_referrals')
      .select('affiliate_id, affiliates!inner(user_id)')
      .eq('referred_user_id', referred_user_id)
      .eq('converted', true)
      .single();

    if (!referral) {
      console.log(`[Referral Bonus] No referrer found for user ${referred_user_id}`);
      return new Response(JSON.stringify({
        success: false,
        message: 'No referrer found for this user'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const referrerUserId = (referral.affiliates as any).user_id;
    console.log(`[Referral Bonus] Found referrer: ${referrerUserId}`);

    // Get bonus settings
    const { data: bonusPercentageSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'partner_referral_bonus_percentage')
      .single();

    const { data: delayDaysSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'partner_referral_delay_days')
      .single();

    const { data: monthlyLimitSetting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'partner_monthly_bonus_limit')
      .single();

    const bonusPercentage = bonusPercentageSetting ? parseFloat(bonusPercentageSetting.setting_value) : 10;
    const delayDays = delayDaysSetting ? parseInt(delayDaysSetting.setting_value) : 7;
    const monthlyLimit = monthlyLimitSetting ? parseFloat(monthlyLimitSetting.setting_value) : 5000;

    // Calculate bonus value
    const bonusValue = (package_value * bonusPercentage) / 100;

    // Calculate available_at date
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + delayDays);

    // Check monthly limit for this referrer
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyBonuses } = await supabase
      .from('referral_bonuses')
      .select('bonus_value')
      .eq('referrer_user_id', referrerUserId)
      .gte('created_at', startOfMonth.toISOString())
      .in('status', ['PENDING', 'AVAILABLE']);

    const currentMonthlyTotal = monthlyBonuses?.reduce((sum, b) => sum + Number(b.bonus_value), 0) || 0;
    const remainingLimit = monthlyLimit - currentMonthlyTotal;

    let finalBonusValue = bonusValue;
    let isBlocked = false;
    let blockedReason: string | null = null;

    if (remainingLimit <= 0) {
      isBlocked = true;
      blockedReason = 'Limite mensal de bônus atingido';
      finalBonusValue = 0;
    } else if (bonusValue > remainingLimit) {
      finalBonusValue = remainingLimit;
      console.log(`[Referral Bonus] Bonus capped to R$ ${finalBonusValue} due to monthly limit`);
    }

    console.log(`[Referral Bonus] Creating bonus: R$ ${finalBonusValue} (${bonusPercentage}% of R$ ${package_value})`);

    // Create the referral bonus record
    const { data: newBonus, error } = await supabase
      .from('referral_bonuses')
      .insert({
        referrer_user_id: referrerUserId,
        referred_user_id,
        purchase_id,
        package_value,
        bonus_percentage: bonusPercentage,
        bonus_value: finalBonusValue,
        status: isBlocked ? 'BLOCKED' : 'PENDING',
        available_at: isBlocked ? null : availableAt.toISOString(),
        blocked_reason: blockedReason
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bonus: ${error.message}`);
    }

    console.log(`[Referral Bonus] Created bonus ${newBonus.id}`);

    return new Response(JSON.stringify({
      success: true,
      bonus: newBonus,
      message: isBlocked 
        ? 'Bonus blocked due to monthly limit' 
        : `Bonus of R$ ${finalBonusValue.toFixed(2)} created, available on ${availableAt.toLocaleDateString('pt-BR')}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Referral Bonus] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
