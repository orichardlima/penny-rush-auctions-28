import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔄 [TIMER-PROTECTION] Checking auctions with expired timers...');
    
    const currentTimeBr = new Date().toISOString();
    
    // Find active auctions where timer has expired (ends_at in the past or time_left <= 0)
    const { data: expiredAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, title, time_left, ends_at, current_price, revenue_target, company_revenue')
      .eq('status', 'active')
      .or(`ends_at.lt.${currentTimeBr},time_left.lte.0`);

    if (fetchError) {
      console.error('❌ [TIMER-PROTECTION] Error fetching expired auctions:', fetchError);
      throw fetchError;
    }

    console.log(`🔍 [TIMER-PROTECTION] Found ${expiredAuctions?.length || 0} expired auctions`);

    if (!expiredAuctions || expiredAuctions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired auctions found',
          processed: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    let processedCount = 0;

    for (const auction of expiredAuctions) {
      console.log(`⏰ [TIMER-PROTECTION] Processing auction ${auction.id} - ${auction.title}`);
      
      // Check if revenue target is met (if set)
      const shouldFinish = auction.revenue_target > 0 && 
                          auction.company_revenue >= auction.revenue_target;
      
      if (shouldFinish) {
        // Finish the auction - revenue target met
        const { error: finishError } = await supabase
          .rpc('finalize_auction', { auction_id: auction.id });
          
        if (finishError) {
          console.error(`❌ [TIMER-PROTECTION] Error finishing auction ${auction.id}:`, finishError);
          continue;
        }
        
        console.log(`🏁 [TIMER-PROTECTION] Auction ${auction.id} finished - revenue target met`);
        processedCount++;
      } else {
        // Add bot bid to extend auction
        const { data: randomBot, error: botError } = await supabase
          .rpc('get_random_bot');
          
        if (botError || !randomBot) {
          console.error(`❌ [TIMER-PROTECTION] Error getting random bot:`, botError);
          continue;
        }
        
        // Insert bot bid
        const { error: bidError } = await supabase
          .from('bids')
          .insert({
            user_id: randomBot,
            auction_id: auction.id,
            bid_amount: auction.current_price + 0.01,
            cost_paid: 0.00 // Bot bids don't cost anything
          });
          
        if (bidError) {
          console.error(`❌ [TIMER-PROTECTION] Error inserting bot bid for auction ${auction.id}:`, bidError);
          continue;
        }
        
        console.log(`🤖 [TIMER-PROTECTION] Bot bid added to auction ${auction.id} - timer reset`);
        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Timer protection completed`,
        processed: processedCount,
        total: expiredAuctions.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('💥 [TIMER-PROTECTION] Critical error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});