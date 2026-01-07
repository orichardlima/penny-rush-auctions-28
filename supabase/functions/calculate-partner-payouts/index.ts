import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PartnerContract {
  id: string;
  user_id: string;
  aporte_value: number;
  monthly_cap: number;
  total_cap: number;
  total_received: number;
  status: string;
  plan_name: string;
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

    // Get the month to process (default: previous month)
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStr = targetMonth.toISOString().split('T')[0];

    console.log(`[Partner Payouts] Processing month: ${monthStr}`);

    // Check if snapshot already exists and is closed
    const { data: existingSnapshot } = await supabase
      .from('monthly_revenue_snapshots')
      .select('*')
      .eq('month', monthStr)
      .single();

    if (existingSnapshot?.is_closed) {
      console.log(`[Partner Payouts] Month ${monthStr} already processed and closed`);
      return new Response(JSON.stringify({
        success: false,
        message: `Month ${monthStr} already processed`,
        snapshot: existingSnapshot
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get partner fund percentage from settings
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'partner_fund_percentage')
      .single();

    const partnerFundPercentage = settingsData ? parseFloat(settingsData.setting_value) : 20;
    console.log(`[Partner Payouts] Partner fund percentage: ${partnerFundPercentage}%`);

    // Calculate gross revenue for the month (from bid_purchases)
    const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

    const { data: purchases, error: purchasesError } = await supabase
      .from('bid_purchases')
      .select('amount_paid')
      .eq('payment_status', 'approved')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    if (purchasesError) {
      throw new Error(`Failed to fetch purchases: ${purchasesError.message}`);
    }

    const grossRevenue = purchases?.reduce((sum, p) => sum + Number(p.amount_paid), 0) || 0;
    const partnerFundValue = (grossRevenue * partnerFundPercentage) / 100;

    console.log(`[Partner Payouts] Gross revenue: R$ ${grossRevenue.toFixed(2)}`);
    console.log(`[Partner Payouts] Partner fund: R$ ${partnerFundValue.toFixed(2)}`);

    // Create or update the revenue snapshot
    const snapshotData = {
      month: monthStr,
      gross_revenue: grossRevenue,
      partner_fund_percentage: partnerFundPercentage,
      partner_fund_value: partnerFundValue,
      is_closed: false
    };

    let snapshot;
    if (existingSnapshot) {
      const { data, error } = await supabase
        .from('monthly_revenue_snapshots')
        .update(snapshotData)
        .eq('id', existingSnapshot.id)
        .select()
        .single();
      if (error) throw error;
      snapshot = data;
    } else {
      const { data, error } = await supabase
        .from('monthly_revenue_snapshots')
        .insert(snapshotData)
        .select()
        .single();
      if (error) throw error;
      snapshot = data;
    }

    // Get all active partner contracts
    const { data: contracts, error: contractsError } = await supabase
      .from('partner_contracts')
      .select('*')
      .eq('status', 'ACTIVE');

    if (contractsError) {
      throw new Error(`Failed to fetch contracts: ${contractsError.message}`);
    }

    if (!contracts || contracts.length === 0) {
      console.log('[Partner Payouts] No active contracts found');
      
      // Close the snapshot
      await supabase
        .from('monthly_revenue_snapshots')
        .update({ is_closed: true, closed_at: new Date().toISOString() })
        .eq('id', snapshot.id);

      return new Response(JSON.stringify({
        success: true,
        message: 'No active contracts to process',
        snapshot,
        payouts: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate total aportes for proportional distribution
    const totalAportes = contracts.reduce((sum, c) => sum + Number(c.aporte_value), 0);
    console.log(`[Partner Payouts] Total aportes: R$ ${totalAportes.toFixed(2)}`);
    console.log(`[Partner Payouts] Active contracts: ${contracts.length}`);

    const payouts: any[] = [];
    const contractUpdates: any[] = [];

    // Calculate payout for each contract
    for (const contract of contracts as PartnerContract[]) {
      // Proportional share of the fund
      const participation = Number(contract.aporte_value) / totalAportes;
      const calculatedAmount = partnerFundValue * participation;

      // Apply monthly cap
      let finalAmount = Math.min(calculatedAmount, Number(contract.monthly_cap));
      const monthlyCapped = calculatedAmount > Number(contract.monthly_cap);

      // Apply total cap (remaining to reach total_cap)
      const remainingToTotalCap = Number(contract.total_cap) - Number(contract.total_received);
      let totalCapped = false;
      
      if (finalAmount > remainingToTotalCap) {
        finalAmount = remainingToTotalCap;
        totalCapped = true;
      }

      // Skip if no payout
      if (finalAmount <= 0) {
        console.log(`[Partner Payouts] Contract ${contract.id}: No payout (already at cap)`);
        continue;
      }

      console.log(`[Partner Payouts] Contract ${contract.id}: Calculated R$ ${calculatedAmount.toFixed(2)}, Final R$ ${finalAmount.toFixed(2)}`);

      // Create payout record
      const payoutData = {
        partner_contract_id: contract.id,
        month: monthStr,
        calculated_amount: calculatedAmount,
        amount: finalAmount,
        monthly_cap_applied: monthlyCapped,
        total_cap_applied: totalCapped,
        status: 'PENDING'
      };

      // Check if payout already exists
      const { data: existingPayout } = await supabase
        .from('partner_payouts')
        .select('id')
        .eq('partner_contract_id', contract.id)
        .eq('month', monthStr)
        .single();

      if (existingPayout) {
        const { data: updatedPayout, error } = await supabase
          .from('partner_payouts')
          .update(payoutData)
          .eq('id', existingPayout.id)
          .select()
          .single();
        if (error) throw error;
        payouts.push(updatedPayout);
      } else {
        const { data: newPayout, error } = await supabase
          .from('partner_payouts')
          .insert(payoutData)
          .select()
          .single();
        if (error) throw error;
        payouts.push(newPayout);
      }

      // Prepare contract update
      const newTotalReceived = Number(contract.total_received) + finalAmount;
      const shouldClose = newTotalReceived >= Number(contract.total_cap);

      contractUpdates.push({
        id: contract.id,
        total_received: newTotalReceived,
        status: shouldClose ? 'CLOSED' : 'ACTIVE',
        closed_at: shouldClose ? new Date().toISOString() : null,
        closed_reason: shouldClose ? 'Teto total atingido' : null
      });
    }

    // Update contracts
    for (const update of contractUpdates) {
      const { error } = await supabase
        .from('partner_contracts')
        .update({
          total_received: update.total_received,
          status: update.status,
          closed_at: update.closed_at,
          closed_reason: update.closed_reason
        })
        .eq('id', update.id);

      if (error) {
        console.error(`[Partner Payouts] Failed to update contract ${update.id}:`, error);
      }
    }

    // Close the snapshot
    await supabase
      .from('monthly_revenue_snapshots')
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq('id', snapshot.id);

    const response = {
      success: true,
      message: `Processed ${payouts.length} payouts for ${monthStr}`,
      snapshot,
      payouts,
      summary: {
        grossRevenue,
        partnerFundValue,
        totalContracts: contracts.length,
        totalPayouts: payouts.length,
        totalDistributed: payouts.reduce((sum, p) => sum + Number(p.amount), 0)
      }
    };

    console.log('[Partner Payouts] Completed:', JSON.stringify(response.summary));

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Partner Payouts] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
