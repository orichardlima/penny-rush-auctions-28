import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Auction {
  id: string;
  status: string;
  starts_at: string;
  updated_at: string;
  total_bids: number;
  company_revenue: number;
  revenue_target: number;
  title: string;
}

interface AuctionTimer {
  auction_id: string;
  timer_started_at: string;
  last_bid_at: string | null;
  seconds_remaining: number;
}

interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const currentTimeBr = new Date().toISOString();
    const currentDate = new Date();

    console.log(`🔄 [SYNC-PROTECTION] Iniciando verificação de leilões - ${currentTimeBr}`);

    // **FASE 1: Ativar leilões em espera cujo horário chegou**
    const { data: waitingAuctions, error: waitingError } = await supabase
      .from('auctions')
      .select('id, title, starts_at')
      .eq('status', 'waiting')
      .lte('starts_at', currentTimeBr);

    if (waitingError) {
      console.error('❌ Erro ao buscar leilões em espera:', waitingError);
      return new Response(JSON.stringify({ error: waitingError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let activatedCount = 0;
    if (waitingAuctions && waitingAuctions.length > 0) {
      for (const auction of waitingAuctions) {
        const { error: activateError } = await supabase
          .from('auctions')
          .update({ 
            status: 'active',
            time_left: 15,
            updated_at: currentTimeBr
          })
          .eq('id', auction.id);

        if (activateError) {
          console.error(`❌ Erro ao ativar leilão ${auction.id}:`, activateError);
        } else {
          console.log(`✅ [ACTIVATION] Leilão "${auction.title}" ativado (${auction.id})`);
          activatedCount++;
        }
      }
    }

    // **FASE 2: Gerenciar timers de leilões ativos**
    const { data: activeAuctions, error: activeError } = await supabase
      .from('auctions')
      .select('id, title, status, updated_at, total_bids, company_revenue, revenue_target, time_left')
      .eq('status', 'active');

    if (activeError) {
      console.error('❌ Erro ao buscar leilões ativos:', activeError);
      return new Response(JSON.stringify({ error: activeError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let timerUpdates = 0;
    let finalizedCount = 0;
    let botBidsAdded = 0;

    if (activeAuctions && activeAuctions.length > 0) {
      // Buscar todos os timers ativos
      const { data: timers, error: timerError } = await supabase
        .from('auction_timers')
        .select('*')
        .in('auction_id', activeAuctions.map(a => a.id));

      if (timerError) {
        console.error('❌ Erro ao buscar timers:', timerError);
      }

      for (const auction of activeAuctions) {
        const timer = timers?.find(t => t.auction_id === auction.id);
        
        if (!timer) {
          // Criar timer se não existir
          await supabase
            .from('auction_timers')
            .insert({
              auction_id: auction.id,
              seconds_remaining: auction.time_left || 15
            });
          continue;
        }

        // Verificar se houve bid recente (último segundo)
        const { data: recentBids, error: bidError } = await supabase
          .from('bids')
          .select('created_at')
          .eq('auction_id', auction.id)
          .gte('created_at', new Date(Date.now() - 2000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (bidError) {
          console.error(`❌ Erro ao verificar bids do leilão ${auction.id}:`, bidError);
          continue;
        }

        let shouldResetTimer = false;
        
        // Se há bid recente, resetar timer
        if (recentBids && recentBids.length > 0) {
          shouldResetTimer = true;
          await supabase
            .from('auction_timers')
            .update({
              last_bid_at: recentBids[0].created_at,
              seconds_remaining: 15,
              updated_at: currentTimeBr
            })
            .eq('auction_id', auction.id);
            
          await supabase
            .from('auctions')
            .update({
              time_left: 15,
              updated_at: currentTimeBr
            })
            .eq('id', auction.id);
            
          console.log(`🔄 [TIMER-RESET] Timer resetado para leilão ${auction.title} por bid recente`);
          timerUpdates++;
          continue;
        }

        // Calcular tempo decorrido desde última atividade
        const lastActivity = timer.last_bid_at || timer.timer_started_at;
        const timeSinceLastActivity = (currentDate.getTime() - new Date(lastActivity).getTime()) / 1000;
        const newSecondsRemaining = Math.max(0, 15 - Math.floor(timeSinceLastActivity));

        // Atualizar timer no banco
        await supabase
          .from('auction_timers')
          .update({
            seconds_remaining: newSecondsRemaining,
            updated_at: currentTimeBr
          })
          .eq('auction_id', auction.id);

        await supabase
          .from('auctions')
          .update({
            time_left: newSecondsRemaining,
            updated_at: currentTimeBr
          })
          .eq('id', auction.id);

        timerUpdates++;

        // **FASE 3: Lógica de proteção/finalização**
        if (newSecondsRemaining <= 0) {
          console.log(`⏰ [TIMER-EXPIRED] Leilão ${auction.title} com timer expirado - verificando proteção`);
          
          // Verificar se deve finalizar ou adicionar bid de proteção
          if (auction.company_revenue >= auction.revenue_target) {
            // Finalizar leilão - meta atingida
            const { data: lastBid } = await supabase
              .from('bids')
              .select('user_id, profiles(full_name)')
              .eq('auction_id', auction.id)
              .limit(1)
              .order('created_at', { ascending: false })
              .single();

            await supabase
              .from('auctions')
              .update({
                status: 'finished',
                finished_at: currentTimeBr,
                winner_id: lastBid?.user_id || null,
                winner_name: lastBid?.profiles?.full_name || null
              })
              .eq('id', auction.id);

            // Remover timer
            await supabase
              .from('auction_timers')
              .delete()
              .eq('auction_id', auction.id);

            console.log(`🏁 [FINALIZED] Leilão "${auction.title}" finalizado - meta atingida (R$${auction.company_revenue}/${auction.revenue_target})`);
            finalizedCount++;
            
          } else {
            // Adicionar bid de bot - meta não atingida
            const { data: randomBot } = await supabase.rpc('get_random_bot');
            
            if (randomBot) {
              const { error: bidError } = await supabase
                .from('bids')
                .insert({
                  auction_id: auction.id,
                  user_id: randomBot,
                  bid_amount: auction.time_left || 0, // Usar current_price + bid_increment seria mais correto
                  cost_paid: 1.00 // Custo padrão do bid
                });

              if (bidError) {
                console.error(`❌ Erro ao inserir bid de bot para leilão ${auction.id}:`, bidError);
              } else {
                console.log(`🤖 [BOT-PROTECTION] Bid de proteção adicionado ao leilão "${auction.title}" - meta não atingida (R$${auction.company_revenue}/${auction.revenue_target})`);
                botBidsAdded++;
              }
            }
          }
        }
      }
    }

    // **FASE 4: Reverter leilões ativos prematuros**
    const { data: prematureAuctions, error: prematureError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, total_bids')
      .eq('status', 'active')
      .gt('starts_at', currentTimeBr)
      .eq('total_bids', 0);

    if (prematureError) {
      console.error('❌ Erro ao buscar leilões prematuros:', prematureError);
    }

    let revertedCount = 0;
    if (prematureAuctions && prematureAuctions.length > 0) {
      for (const auction of prematureAuctions) {
        const { error: revertError } = await supabase
          .from('auctions')
          .update({ 
            status: 'waiting',
            time_left: 15,
            updated_at: currentTimeBr
          })
          .eq('id', auction.id);

        if (revertError) {
          console.error(`❌ Erro ao reverter leilão ${auction.id}:`, revertError);
        } else {
          // Remover timer do leilão revertido
          await supabase
            .from('auction_timers')
            .delete()
            .eq('auction_id', auction.id);
            
          console.log(`⏪ [REVERTED] Leilão "${auction.title}" revertido para waiting - ativado prematuramente`);
          revertedCount++;
        }
      }
    }

    const summary = {
      timestamp: currentTimeBr,
      activated: activatedCount,
      timer_updates: timerUpdates,
      finalized: finalizedCount,
      bot_bids_added: botBidsAdded,
      reverted: revertedCount,
      success: true
    };

    console.log(`✅ [SYNC-COMPLETE] Ativados: ${activatedCount} | Timers: ${timerUpdates} | Finalizados: ${finalizedCount} | Bots: ${botBidsAdded} | Revertidos: ${revertedCount}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 [CRITICAL-ERROR] Erro crítico na sincronização:', error);
    return new Response(JSON.stringify({ 
      error: 'Critical sync error', 
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});