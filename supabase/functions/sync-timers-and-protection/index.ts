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
  console.log(`🔄 [PROTECTION-CHECK] Verificação de proteção - ${currentTimeBr}`);
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
        console.log(`✅ [ACTIVATION] Leilão "${auction.title}" ativado`);
        activatedCount++;
      }
    }
  }

  // **FASE 2: Verificar leilões ativos para proteção ou finalização**
  const { data: activeAuctions, error: activeError } = await supabase
    .from('auctions')
    .select('id, title, current_price, market_value, company_revenue, revenue_target, last_bid_at, bid_increment')
    .eq('status', 'active');

  if (activeError) {
    console.error('❌ Erro ao buscar leilões ativos:', activeError);
    return new Response(JSON.stringify({ error: activeError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let finalizedCount = 0;
  let botBidsAdded = 0;

  if (activeAuctions && activeAuctions.length > 0) {
    for (const auction of activeAuctions) {
      // Calcular tempo desde último lance
      const lastBidTime = new Date(auction.last_bid_at).getTime();
      const currentTime = Date.now();
      const secondsSinceLastBid = Math.floor((currentTime - lastBidTime) / 1000);

      console.log(`⏰ [CHECK] Leilão "${auction.title}": ${secondsSinceLastBid}s inativo`);

      // Verificar se meta foi atingida - finalizar independente de inatividade
      if (Number(auction.company_revenue) >= Number(auction.revenue_target)) {
        console.log(`🎯 [META-OK] Leilão "${auction.title}" - meta atingida, finalizando`);
        
        const { data: lastBidData } = await supabase
          .from('bids')
          .select('user_id')
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: winnerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', lastBidData?.user_id)
          .single();

        await supabase
          .from('auctions')
          .update({
            status: 'finished',
            finished_at: currentTimeBr,
            winner_id: lastBidData?.user_id || null,
            winner_name: winnerProfile?.full_name || null
          })
          .eq('id', auction.id);

        console.log(`🏁 [FINALIZED] Leilão "${auction.title}" finalizado - meta atingida`);
        finalizedCount++;
        continue;
      }

      // SE INATIVO HÁ 15+ SEGUNDOS
      if (secondsSinceLastBid >= 15) {
        const currentPrice = Number(auction.current_price);
        const marketValue = Number(auction.market_value);

        // SE HÁ PREJUÍZO (preço > valor da loja)
        if (currentPrice > marketValue) {
          console.log(`💰 [PREJUÍZO] Leilão "${auction.title}": R$${currentPrice} > R$${marketValue}`);

          // CONTROLE ANTI-SPAM: Verificar se já foi adicionado bot nos últimos 5s
          const { data: recentBot } = await supabase
            .from('bids')
            .select('id')
            .eq('auction_id', auction.id)
            .eq('cost_paid', 0) // Bots internos têm cost_paid = 0
            .gte('created_at', new Date(Date.now() - 5000).toISOString())
            .limit(1);

          if (recentBot && recentBot.length > 0) {
            console.log(`🚫 [ANTI-SPAM] Leilão "${auction.title}" - bot já adicionado recentemente`);
            continue;
          }

          // ADICIONAR UM BOT INTERNO
          const { data: randomBot } = await supabase.rpc('get_random_bot');
          
          if (randomBot) {
            const { error: bidError } = await supabase
              .from('bids')
              .insert({
                auction_id: auction.id,
                user_id: randomBot,
                bid_amount: currentPrice + Number(auction.bid_increment),
                cost_paid: 0 // Bot interno não paga
              });

            if (!bidError) {
              console.log(`🤖 [PROTEÇÃO] Bot adicionado ao leilão "${auction.title}" - prejuízo evitado`);
              botBidsAdded++;
            } else {
              console.error(`❌ [ERRO] Falha ao adicionar bot: ${bidError.message}`);
            }
          }
        } else {
          console.log(`✅ [OK] Leilão "${auction.title}" inativo mas sem prejuízo - continuando`);
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
    auctions_checked: activeAuctions?.length || 0,
    execution_time_ms: executionTime,
    type: 'protection_system_simplified',
    success: true
  };

  console.log(`✅ [PROTECTION-COMPLETE] Ativados: ${activatedCount} | Finalizados: ${finalizedCount} | Bots: ${botBidsAdded} | Verificados: ${activeAuctions?.length || 0} | Tempo: ${executionTime}ms`);

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