import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      auctions: {
        Row: {
          id: string;
          status: string;
          starts_at: string;
          ends_at: string;
          time_left: number;
          title: string;
          total_bids: number;
        };
      };
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Usar fuso brasileiro para todas as operações
    const brazilTimezone = 'America/Sao_Paulo';
    const now = new Date();
    const brazilDate = new Date(now.toLocaleString("en-US", {timeZone: brazilTimezone}));
    const currentTime = brazilDate.toISOString();
    
    console.log(`🔍 [SYNC] Iniciando sincronização às ${currentTime} (BR)`);

    // 1. Ativar leilões que estão "waiting" e já passaram do starts_at
    // Buscar todos os leilões waiting e fazer comparação manual com fuso brasileiro
    const { data: waitingAuctions, error: waitingError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, status')
      .eq('status', 'waiting');

    if (waitingError) {
      console.error('Erro ao buscar leilões waiting:', waitingError);
      throw waitingError;
    }

    // Filtrar leilões que realmente devem ser ativados
    const auctionsToActivate = (waitingAuctions || []).filter(auction => {
      if (!auction.starts_at) return false;
      
      // Converter starts_at para fuso brasileiro para comparação precisa
      const startsAtBrazil = new Date(auction.starts_at).toLocaleString("en-US", {timeZone: brazilTimezone});
      const startsAtDate = new Date(startsAtBrazil);
      
      const shouldActivate = startsAtDate <= brazilDate;
      
      if (shouldActivate) {
        console.log(`🎯 [CHECK] Leilão ${auction.id} deve ser ativado - starts_at (BR): ${startsAtDate.toISOString()}, now (BR): ${brazilDate.toISOString()}`);
      }
      
      return shouldActivate;
    });

    let activatedCount = 0;
    for (const auction of auctionsToActivate) {
      console.log(`🚀 [ACTIVATE] Ativando leilão ${auction.id} ("${auction.title}") - starts_at: ${auction.starts_at}`);
      
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          time_left: 15,
          updated_at: currentTime
        })
        .eq('id', auction.id);

      if (updateError) {
        console.error(`Erro ao ativar leilão ${auction.id}:`, updateError);
      } else {
        activatedCount++;
        console.log(`✅ [ACTIVATE] Leilão ${auction.id} ativado com sucesso!`);
      }
    }

    // 2. DECREMENTAR TIMERS de leilões ativos (NOVA FUNCIONALIDADE)
    const { data: activeAuctions, error: activeError } = await supabase
      .from('auctions')
      .select('id, title, time_left, updated_at')
      .eq('status', 'active');

    if (activeError) {
      console.error('Erro ao buscar leilões ativos:', activeError);
    } else {
      let decrementedCount = 0;
      let finalizedCount = 0;
      
      for (const auction of activeAuctions || []) {
        // Buscar último lance
        const { data: lastBids, error: bidError } = await supabase
          .from('bids')
          .select('created_at')
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (bidError) {
          console.error(`Erro ao buscar lances do leilão ${auction.id}:`, bidError);
          continue;
        }

        // Determinar última atividade (último lance ou updated_at)
        const lastBidTime = lastBids && lastBids.length > 0 ? lastBids[0].created_at : null;
        const lastActivityTime = lastBidTime || auction.updated_at;
        
        // Converter para fuso brasileiro
        const lastActivityBrazil = new Date(lastActivityTime).toLocaleString("en-US", {timeZone: brazilTimezone});
        const lastActivityDate = new Date(lastActivityBrazil);
        
        // Calcular segundos desde última atividade
        const secondsSinceActivity = Math.floor((brazilDate.getTime() - lastActivityDate.getTime()) / 1000);
        
        // Calcular novo time_left baseado na inatividade
        const newTimeLeft = Math.max(0, 15 - secondsSinceActivity);
        
        console.log(`⏱️ [TIMER] Leilão ${auction.id}: ${secondsSinceActivity}s inatividade, time_left: ${auction.time_left} → ${newTimeLeft}`);
        
        if (newTimeLeft <= 0) {
          // FINALIZAR LEILÃO
          const { data: winnerBids, error: winnerError } = await supabase
            .from('bids')
            .select('user_id, profiles!inner(full_name)')
            .eq('auction_id', auction.id)
            .order('created_at', { ascending: false })
            .limit(1);

          let winnerId = null;
          let winnerName = 'Nenhum ganhador';
          
          if (!winnerError && winnerBids && winnerBids.length > 0) {
            const winner = winnerBids[0];
            winnerId = winner.user_id;
            winnerName = winner.profiles?.full_name || `Usuário ${winner.user_id.substring(0, 8)}`;
          }

          const { error: finalizeError } = await supabase
            .from('auctions')
            .update({
              status: 'finished',
              time_left: 0,
              winner_id: winnerId,
              winner_name: winnerName,
              finished_at: currentTime,
              updated_at: currentTime
            })
            .eq('id', auction.id);

          if (finalizeError) {
            console.error(`Erro ao finalizar leilão ${auction.id}:`, finalizeError);
          } else {
            finalizedCount++;
            console.log(`🏁 [FINALIZED] Leilão ${auction.id} ("${auction.title}") finalizado! Ganhador: ${winnerName}`);
          }
        } else if (auction.time_left !== newTimeLeft) {
          // DECREMENTAR TIMER
          const { error: decrementError } = await supabase
            .from('auctions')
            .update({
              time_left: newTimeLeft,
              updated_at: currentTime
            })
            .eq('id', auction.id);

          if (decrementError) {
            console.error(`Erro ao decrementar timer do leilão ${auction.id}:`, decrementError);
          } else {
            decrementedCount++;
            console.log(`⏰ [DECREMENTED] Leilão ${auction.id}: timer ${auction.time_left}s → ${newTimeLeft}s`);
          }
        }
      }
      
      if (decrementedCount > 0 || finalizedCount > 0) {
        console.log(`⏰ [TIMERS] ${decrementedCount} timers decrementados, ${finalizedCount} leilões finalizados`);
      }
    }

    // 3. Proteção: verificar se há leilões que não deveriam estar ativos
    // Buscar todos os leilões ativos e fazer verificação manual
    const { data: allActiveAuctions, error: prematureError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, status, total_bids')
      .eq('status', 'active')
      .eq('total_bids', 0); // Só revertir se não houver lances

    const prematureAuctions = (allActiveAuctions || []).filter(auction => {
      if (!auction.starts_at) return false;
      
      // Converter starts_at para fuso brasileiro para comparação precisa
      const startsAtBrazil = new Date(auction.starts_at).toLocaleString("en-US", {timeZone: brazilTimezone});
      const startsAtDate = new Date(startsAtBrazil);
      
      const isPremature = startsAtDate > brazilDate;
      
      if (isPremature) {
        console.log(`⚠️ [CHECK] Leilão ${auction.id} é prematuro - starts_at (BR): ${startsAtDate.toISOString()}, now (BR): ${brazilDate.toISOString()}`);
      }
      
      return isPremature;
    });

    if (prematureError) {
      console.error('Erro ao buscar leilões prematuros:', prematureError);
    } else {
      let revertedCount = 0;
      for (const auction of prematureAuctions || []) {
        console.log(`⚠️ [PROTECT] Leilão ${auction.id} está ativo prematuramente! Revertendo para waiting...`);
        
        const { error: revertError } = await supabase
          .from('auctions')
          .update({
            status: 'waiting',
            ends_at: null,
            time_left: 15,
            updated_at: currentTime
          })
          .eq('id', auction.id);

        if (revertError) {
          console.error(`Erro ao reverter leilão ${auction.id}:`, revertError);
        } else {
          revertedCount++;
          console.log(`🔒 [PROTECT] Leilão ${auction.id} revertido para waiting`);
        }
      }
      
      if (revertedCount > 0) {
        console.log(`🔒 [PROTECT] ${revertedCount} leilões revertidos para waiting`);
      }
    }

    const summary = {
      timestamp: currentTime,
      waiting_auctions: waitingAuctions?.length || 0,
      activated_count: activatedCount,
      premature_auctions: prematureAuctions?.length || 0,
      reverted_count: prematureAuctions?.length || 0
    };

    console.log(`🏁 [SYNC] Sincronização concluída:`, summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização de timers concluída',
        ...summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na sincronização de timers:', error);
    
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