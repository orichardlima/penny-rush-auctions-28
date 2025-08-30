import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { auction_id } = await req.json();
    
    if (!auction_id) {
      return new Response(
        JSON.stringify({ error: 'auction_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🏁 [FINALIZE] Iniciando finalização do leilão: ${auction_id}`);

    // 1. Verificar se leilão existe e está ativo
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('id, title, status, time_left')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      console.error(`❌ [FINALIZE] Leilão não encontrado: ${auction_id}`, auctionError);
      return new Response(
        JSON.stringify({ error: 'Leilão não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (auction.status !== 'active') {
      console.log(`⚠️ [FINALIZE] Leilão ${auction_id} não está ativo (status: ${auction.status})`);
      return new Response(
        JSON.stringify({ 
          message: 'Leilão não está ativo',
          current_status: auction.status 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar inatividade real
    const { data: lastBids, error: bidError } = await supabase
      .from('bids')
      .select('created_at, user_id')
      .eq('auction_id', auction_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (bidError) {
      console.error(`❌ [FINALIZE] Erro ao buscar lances: ${auction_id}`, bidError);
      throw bidError;
    }

    const now = new Date();
    const lastBidTime = lastBids && lastBids.length > 0 ? new Date(lastBids[0].created_at) : null;
    const secondsSinceLastBid = lastBidTime 
      ? Math.floor((now.getTime() - lastBidTime.getTime()) / 1000)
      : Infinity;

    console.log(`⏱️ [FINALIZE] Leilão "${auction.title}": ${secondsSinceLastBid}s desde último lance`);

    // 3. Verificar se pode finalizar (15+ segundos de inatividade)
    if (lastBidTime && secondsSinceLastBid < 15) {
      console.log(`⏳ [FINALIZE] Muito cedo para finalizar - apenas ${secondsSinceLastBid}s de inatividade`);
      return new Response(
        JSON.stringify({ 
          message: 'Leilão ainda ativo',
          seconds_since_last_bid: secondsSinceLastBid,
          required_seconds: 15
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Determinar ganhador
    let winnerId = null;
    let winnerName = 'Nenhum ganhador';
    
    if (lastBids && lastBids.length > 0) {
      winnerId = lastBids[0].user_id;
      
      // Buscar nome do ganhador
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', winnerId)
        .single();
      
      winnerName = profile?.full_name || `Usuário ${winnerId.substring(0, 8)}`;
    }

    // 5. FINALIZAR LEILÃO (forçado, sem triggers de proteção)
    const { error: finalizeError } = await supabase
      .from('auctions')
      .update({
        status: 'finished',
        time_left: 0,
        winner_id: winnerId,
        winner_name: winnerName,
        finished_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', auction_id);

    if (finalizeError) {
      console.error(`❌ [FINALIZE] Erro ao finalizar leilão ${auction_id}:`, finalizeError);
      throw finalizeError;
    }

    const result = {
      success: true,
      auction_id,
      auction_title: auction.title,
      winner_id: winnerId,
      winner_name: winnerName,
      seconds_since_last_bid: secondsSinceLastBid,
      finalized_at: now.toISOString()
    };

    console.log(`✅ [FINALIZE] Leilão "${auction.title}" finalizado com sucesso!`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [FINALIZE] Erro na finalização:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});