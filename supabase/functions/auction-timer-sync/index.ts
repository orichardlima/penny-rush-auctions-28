import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔄 Auction timer sync started at', new Date().toISOString());
    
    // 1. Buscar leilões ativos com timer zerado ou ends_at vencido
    const { data: orphanedAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, title, status, time_left, ends_at, current_price, total_bids')
      .eq('status', 'active')
      .or('time_left.lte.0,ends_at.lt.now()');

    if (fetchError) {
      console.error('❌ Error fetching orphaned auctions:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${orphanedAuctions?.length || 0} orphaned auctions`);

    if (!orphanedAuctions || orphanedAuctions.length === 0) {
      console.log('✅ No orphaned auctions found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orphaned auctions found',
          processed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // 2. Para cada leilão órfão, finalizar
    const processedAuctions = [];
    
    for (const auction of orphanedAuctions) {
      try {
        console.log(`🔧 Processing orphaned auction: ${auction.id} - ${auction.title}`);
        
        // Buscar o último lance para determinar o ganhador
        const { data: lastBid, error: bidError } = await supabase
          .from('bids')
          .select(`
            user_id,
            profiles!inner(full_name, user_id)
          `)
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let winnerName = null;
        let winnerId = null;

        if (lastBid && !bidError) {
          winnerId = lastBid.user_id;
          winnerName = lastBid.profiles?.full_name || 
                     `Usuário ${lastBid.user_id.substring(0, 8)}`;
        }

        // Finalizar o leilão
        const { error: updateError } = await supabase
          .from('auctions')
          .update({
            status: 'finished',
            time_left: 0,
            winner_id: winnerId,
            winner_name: winnerName,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', auction.id);

        if (updateError) {
          console.error(`❌ Error finalizing auction ${auction.id}:`, updateError);
          continue;
        }

        console.log(`✅ Finalized auction ${auction.id} - Winner: ${winnerName || 'No winner'}`);
        processedAuctions.push({
          id: auction.id,
          title: auction.title,
          winner: winnerName,
          time_left_was: auction.time_left,
          ends_at_was: auction.ends_at
        });

      } catch (auctionError) {
        console.error(`❌ Error processing auction ${auction.id}:`, auctionError);
      }
    }

    // 3. Atualizar timers de leilões ativos restantes
    const { error: timerSyncError } = await supabase.rpc('update_auction_timers');
    
    if (timerSyncError) {
      console.error('❌ Error syncing timers:', timerSyncError);
    } else {
      console.log('✅ Timer sync completed');
    }

    console.log(`🎯 Timer sync completed. Processed ${processedAuctions.length} orphaned auctions`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedAuctions.length} orphaned auctions`,
        processed: processedAuctions.length,
        auctions: processedAuctions
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Timer sync failed:', error);
    
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