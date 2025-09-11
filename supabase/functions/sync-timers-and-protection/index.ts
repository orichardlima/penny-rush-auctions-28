import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const currentTimeBr = new Date().toISOString();
    const threeSecondsAgo = new Date(Date.now() - 3000).toISOString(); // Tempo real - 3 segundos

  console.log(`🚀 [REAL-TIME-PROTECTION] Verificação ultra-rápida - ${currentTimeBr}`);
  const startTime = Date.now();

  // **FASE 1: Ativar leilões em espera cujo horário chegou**
    const { data: waitingAuctions, error: waitingError } = await supabase
      .from('auctions')
      .select('id, title, starts_at')
      .eq('status', 'waiting')
      .lte('starts_at', currentTimeBr);

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

        if (!activateError) {
          console.log(`✅ [ACTIVATION] Leilão "${auction.title}" ativado (${auction.id})`);
          activatedCount++;
        }
      }
    }

    // **FASE 2: Verificar leilões inativos há 3+ segundos (proteção em tempo real)**
    const { data: inactiveAuctions, error: inactiveError } = await supabase
      .from('auctions')
      .select('id, title, company_revenue, revenue_target, current_price, market_value, bid_increment, updated_at')
      .eq('status', 'active')
      .lt('updated_at', threeSecondsAgo);

    if (inactiveError) {
      console.error('❌ Erro ao buscar leilões inativos:', inactiveError);
      return new Response(JSON.stringify({ error: inactiveError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalizedCount = 0;
    let botBidsAdded = 0;

    if (inactiveAuctions && inactiveAuctions.length > 0) {
      for (const auction of inactiveAuctions) {
        console.log(`⚡ [REAL-TIME-CHECK] Leilão "${auction.title}" inativo há 3+ segundos`);
        console.log(`🏪 [REAL-TIME-CHECK] Preço: R$${auction.current_price} | Loja: R$${auction.market_value} | Meta: R$${auction.company_revenue}/${auction.revenue_target}`);
        
        // Verificar se meta foi atingida
        if (auction.company_revenue >= auction.revenue_target) {
          // Finalizar leilão - meta atingida
          const { data: lastBid } = await supabase
            .from('bids')
            .select(`
              user_id,
              profiles!inner(full_name)
            `)
            .eq('auction_id', auction.id)
            .order('created_at', { ascending: false })
            .limit(1)
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

          console.log(`🏁 [REAL-TIME-FINALIZED] Leilão "${auction.title}" finalizado - meta atingida (R$${auction.company_revenue}/${auction.revenue_target})`);
          finalizedCount++;
          
        } else if (auction.current_price > auction.market_value) {
          // NOVA REGRA: Preço ultrapassou valor da loja - verificar último lance
          console.log(`⚠️ [REAL-TIME-CHECK] Preço ultrapassou valor da loja! Verificando último lance...`);
          
          const { data: lastBid } = await supabase
            .from('bids')
            .select(`
              user_id,
              cost_paid,
              profiles!inner(full_name, is_bot)
            `)
            .eq('auction_id', auction.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (lastBid && lastBid.profiles?.is_bot) {
            // Último lance foi de bot - FINALIZAR para evitar prejuízo
            console.log(`🛑 [REAL-TIME-CHECK] Último lance foi de bot - finalizando para evitar prejuízo`);
            
            await supabase
              .from('auctions')
              .update({
                status: 'finished',
                finished_at: currentTimeBr,
                winner_id: lastBid.user_id,
                winner_name: lastBid.profiles.full_name || 'Bot'
              })
              .eq('id', auction.id);

            console.log(`🏁 [REAL-TIME-FINALIZED] Leilão "${auction.title}" finalizado - proteção contra prejuízo`);
            finalizedCount++;
            
          } else {
            // Último lance foi de usuário ou não há lances - adicionar bid de bot
            console.log(`👤 [REAL-TIME-CHECK] Último lance foi de usuário - adicionando bid de proteção`);
            
            const { data: randomBot } = await supabase.rpc('get_random_bot');
            
            if (randomBot) {
              const { error: bidError } = await supabase
                .from('bids')
                .insert({
                  auction_id: auction.id,
                  user_id: randomBot,
                  bid_amount: auction.current_price + auction.bid_increment,
                  cost_paid: 0 // Bot interno não paga
                });

              if (!bidError) {
                console.log(`🤖 [REAL-TIME-BOT] Bid de proteção adicionado ao leilão "${auction.title}" - preço > loja + usuário`);
                botBidsAdded++;
              }
            }
          }
          
        } else {
          // Adicionar bid de bot interno - meta não atingida
          const { data: randomBot } = await supabase.rpc('get_random_bot');
          
          if (randomBot) {
            const { error: bidError } = await supabase
              .from('bids')
              .insert({
                auction_id: auction.id,
                user_id: randomBot,
                bid_amount: auction.current_price + auction.bid_increment,
                cost_paid: 0 // Bot interno não paga
              });

            if (!bidError) {
              console.log(`🤖 [REAL-TIME-BOT] Bid de proteção adicionado ao leilão "${auction.title}" - meta não atingida (R$${auction.company_revenue}/${auction.revenue_target})`);
              botBidsAdded++;
            }
          }
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const summary = {
      timestamp: currentTimeBr,
      activated: activatedCount,
      finalized: finalizedCount,
      bot_bids_added: botBidsAdded,
      execution_time_ms: executionTime,
      type: 'real_time_protection',
      success: true
    };

    console.log(`⚡ [REAL-TIME-COMPLETE] Ativados: ${activatedCount} | Finalizados: ${finalizedCount} | Bots: ${botBidsAdded} | Tempo: ${executionTime}ms`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 [BACKUP-ERROR] Erro crítico no backup:', error);
    return new Response(JSON.stringify({ 
      error: 'Backup error', 
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});