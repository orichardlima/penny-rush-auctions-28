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

    console.log(`🏁 [FINALIZE-AUCTION] Iniciando finalização do leilão ${auction_id}`);

    // Buscar dados do leilão
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      console.error(`❌ [FINALIZE-ERROR] Leilão não encontrado: ${auction_id}`, auctionError);
      return new Response(
        JSON.stringify({ error: 'Leilão não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se já está finalizado
    if (auction.status === 'finished') {
      console.log(`✅ [FINALIZE-SKIP] Leilão ${auction_id} já finalizado`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Leilão já finalizado',
          auction_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é um leilão ativo
    if (auction.status !== 'active') {
      console.log(`⚠️ [FINALIZE-SKIP] Leilão ${auction_id} não está ativo (status: ${auction.status})`);
      return new Response(
        JSON.stringify({ 
          error: 'Leilão não está ativo',
          current_status: auction.status 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar último lance para verificar inatividade
    const { data: lastBids, error: bidError } = await supabase
      .from('bids')
      .select('created_at, user_id')
      .eq('auction_id', auction_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (bidError) {
      console.error(`❌ [FINALIZE-ERROR] Erro ao buscar lances:`, bidError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar lances' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const lastBidTime = lastBids && lastBids.length > 0 ? new Date(lastBids[0].created_at) : null;
    const lastActivityTime = lastBidTime || new Date(auction.updated_at);
    const secondsSinceActivity = Math.floor((now.getTime() - lastActivityTime.getTime()) / 1000);

    console.log(`🔍 [FINALIZE-CHECK] Leilão ${auction_id}: ${secondsSinceActivity}s desde última atividade`);

    // Verificar se há inatividade suficiente (15+ segundos)
    if (secondsSinceActivity < 15) {
      console.log(`⏳ [FINALIZE-DENIED] Leilão ${auction_id} ainda ativo (${secondsSinceActivity}s < 15s)`);
      return new Response(
        JSON.stringify({ 
          error: 'Leilão ainda ativo',
          seconds_since_activity: secondsSinceActivity,
          minimum_required: 15
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar ganhador
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

    // FINALIZAR LEILÃO
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
      console.error(`❌ [FINALIZE-ERROR] Erro ao finalizar leilão ${auction_id}:`, finalizeError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao finalizar leilão',
          details: finalizeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🏁 [FINALIZE-SUCCESS] Leilão ${auction_id} finalizado! Ganhador: "${winnerName}" (${secondsSinceActivity}s inatividade)`);

    return new Response(
      JSON.stringify({
        success: true,
        auction_id,
        winner_id: winnerId,
        winner_name: winnerName,
        seconds_since_activity: secondsSinceActivity,
        finalized_at: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [FINALIZE-CRITICAL] Erro crítico na finalização:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        message: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});