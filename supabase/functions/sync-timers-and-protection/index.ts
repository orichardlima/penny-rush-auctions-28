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
    const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();

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
          console.log(`✅ [ACTIVATION] Leilão "${auction.title}" ativado (${auction.id})`);
          activatedCount++;
        }
      }
    }

    // **FASE 2A: Verificar leilões com PREJUÍZO imediatamente (sem esperar inatividade)**
    const { data: allActiveAuctions, error: riskError } = await supabase
      .from('auctions')
      .select('id, title, company_revenue, revenue_target, current_price, market_value, bid_increment, last_bid_at')
      .eq('status', 'active');
    
    // Filtrar leilões com risco no JavaScript (current_price > market_value)
    const riskAuctions = allActiveAuctions?.filter(auction => 
      Number(auction.current_price) > Number(auction.market_value)
    ) || [];
      
    // **FASE 2B: Verificar leilões inativos por último lance há 15+ segundos**
    const { data: inactiveAuctions, error: inactiveError } = await supabase
      .from('auctions')
      .select('id, title, company_revenue, revenue_target, current_price, market_value, bid_increment, last_bid_at')
      .eq('status', 'active')
      .or(`last_bid_at.lt.${fifteenSecondsAgo},time_left.eq.0`); // Inativo por último lance OU timer zerado

    // **FASE 2C: Buscar leilões ativos para verificar se devem ser finalizados**
    const { data: botLastBidAuctions, error: botBidError } = await supabase
      .from('auctions')
      .select('id, title, company_revenue, revenue_target, current_price, market_value, last_bid_at')
      .eq('status', 'active');

    if (riskError || inactiveError || botBidError) {
      console.error('❌ Erro ao buscar leilões:', riskError || inactiveError || botBidError);
      return new Response(JSON.stringify({ error: (riskError || inactiveError || botBidError)?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalizedCount = 0;
    let botBidsAdded = 0;

    // **PROCESSAR LEILÕES COM RISCO DE PREJUÍZO PRIMEIRO (imediato)**
    console.log(`🔍 [RISK-ANALYSIS] Encontrados ${riskAuctions.length} leilões com risco de prejuízo`);
    
    if (riskAuctions && riskAuctions.length > 0) {
      for (const auction of riskAuctions) {
        console.log(`⚠️ [RISK-CHECK] Leilão "${auction.title}" (${auction.id})`);
        console.log(`💰 [RISK-CHECK] Preço: R$${auction.current_price} > Loja: R$${auction.market_value}`);
        console.log(`🎯 [RISK-CHECK] Receita: R$${auction.company_revenue} / Meta: R$${auction.revenue_target}`);
        
        // Verificar se meta foi atingida
        if (Number(auction.company_revenue) >= Number(auction.revenue_target)) {
          console.log(`✅ [RISK-CHECK] Meta atingida - finalizando`);
          
          const { data: lastBid } = await supabase
            .from('bids')
            .select(`user_id, profiles!inner(full_name)`)
            .eq('auction_id', auction.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Buscar último lance para winner data
          const { data: winnerBidData } = await supabase
            .from('bids')
            .select('user_id')
            .eq('auction_id', auction.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { data: winnerProfileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', winnerBidData?.user_id)
            .single();

          await supabase
            .from('auctions')
            .update({
              status: 'finished',
              finished_at: currentTimeBr,
              winner_id: winnerBidData?.user_id || null,
              winner_name: winnerProfileData?.full_name || null
            })
            .eq('id', auction.id);

          console.log(`🏁 [RISK-FINALIZED] Leilão "${auction.title}" finalizado - meta atingida`);
          finalizedCount++;
          continue;
        }
        
        // Meta não atingida - verificar último lance
        console.log(`🔍 [RISK-CHECK] Meta não atingida - verificando último lance...`);
        
        // Buscar último lance separadamente para evitar problemas de JOIN
        const { data: lastBidData, error: bidError } = await supabase
          .from('bids')
          .select('user_id, created_at')
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (bidError) {
          console.error(`❌ [RISK-CHECK] Erro ao buscar último lance: ${bidError.message}`);
          continue;
        }

        // Buscar perfil do usuário do último lance
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, is_bot')
          .eq('user_id', lastBidData.user_id)
          .single();

        if (profileError) {
          console.error(`❌ [RISK-CHECK] Erro ao buscar perfil: ${profileError.message}`);
          continue;
        }

        console.log(`👤 [RISK-CHECK] Último lance: ${profileData?.full_name} (Bot: ${profileData?.is_bot})`);

        if (profileData && profileData.is_bot) {
          // Último lance foi de bot - FINALIZAR IMEDIATAMENTE
          console.log(`🛑 [RISK-CHECK] CONDIÇÕES ATENDIDAS - Finalizando IMEDIATAMENTE:`);
          console.log(`   • Preço ${auction.current_price} > Valor loja ${auction.market_value} ✅`);
          console.log(`   • Último lance foi de bot ✅`);
          console.log(`   • Meta não atingida ✅`);
          
          const { error: finalizeError } = await supabase
            .from('auctions')
            .update({
              status: 'finished',
              finished_at: currentTimeBr,
              winner_id: lastBidData.user_id,
              winner_name: profileData.full_name || 'Bot'
            })
            .eq('id', auction.id);

          if (finalizeError) {
            console.error(`❌ [RISK-CHECK] Erro ao finalizar: ${finalizeError.message}`);
          } else {
            console.log(`🏁 [RISK-FINALIZED] Leilão "${auction.title}" finalizado - proteção contra prejuízo`);
            finalizedCount++;
          }
        } else {
          // CENÁRIO 2: Último lance foi de humano - ADICIONAR BOT DE PROTEÇÃO IMEDIATAMENTE
          console.log(`🛑 [RISK-PROTECTION] Último lance foi de usuário - adicionando bot de proteção IMEDIATAMENTE`);
          
          // Buscar bot aleatório
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
              console.log(`🤖 [RISK-BOT] Bot de proteção adicionado ao leilão "${auction.title}" - proteção contra prejuízo`);
              botBidsAdded++;
            } else {
              console.error(`❌ [RISK-BOT] Erro ao adicionar bot de proteção: ${bidError.message}`);
            }
          } else {
            console.error(`❌ [RISK-BOT] Nenhum bot disponível para proteção`);
          }
        }
      }
    }

    // **PROCESSAR LEILÕES COM ÚLTIMO LANCE DE BOT (finalizar após 15s de inatividade)**
    console.log(`🤖 [BOT-FINALIZE] Verificando ${botLastBidAuctions?.length || 0} leilões ativos para possível finalização`);
    
    if (botLastBidAuctions && botLastBidAuctions.length > 0) {
      for (const auction of botLastBidAuctions) {
        // Pular se já foi processado na lista de risco OU inativo
        const wasProcessedInRisk = riskAuctions?.some(r => r.id === auction.id) || false;
        const wasProcessedInInactive = inactiveAuctions?.some(i => i.id === auction.id) || false;
        
        if (wasProcessedInRisk) {
          console.log(`⏭️ [BOT-SKIP] Leilão "${auction.title}" já processado na verificação de risco`);
          continue;
        }
        
        if (wasProcessedInInactive) {
          console.log(`⏭️ [BOT-SKIP] Leilão "${auction.title}" já processado na verificação de inativos`);
          continue;
        }
        // Calcular tempo exato desde último lance
        const lastBidTime = new Date(auction.last_bid_at).getTime();
        const currentTime = Date.now();
        const secondsSinceLastBid = Math.floor((currentTime - lastBidTime) / 1000);
        
        console.log(`🕐 [BOT-CHECK] Leilão "${auction.title}": ${secondsSinceLastBid}s desde último lance`);
        console.log(`   📅 Último lance: ${auction.last_bid_at}`);
        console.log(`   📅 Agora: ${new Date(currentTime).toISOString()}`);
        
        // CRÍTICO: Só prosseguir se realmente passaram 15+ segundos
        if (secondsSinceLastBid < 15) {
          console.log(`⏭️ [BOT-SKIP] Leilão "${auction.title}" ainda ativo (apenas ${secondsSinceLastBid}s)`);
          continue;
        }
        
        // Verificar se o último lance realmente foi de bot
        const { data: lastBidData } = await supabase
          .from('bids')
          .select('user_id, created_at')
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, is_bot')
          .eq('user_id', lastBidData?.user_id)
          .single();

        if (profileData?.is_bot) {
          // VERIFICAR SE HÁ PREJUÍZO REAL - só finalizar se houver
          const currentPrice = Number(auction.current_price);
          const marketValue = Number(auction.market_value);
          
          console.log(`💰 [BOT-CHECK] Preço: R$${currentPrice} | Loja: R$${marketValue}`);
          
          // CRÍTICO: Só finalizar se há PREJUÍZO (preço > valor da loja)
          if (currentPrice <= marketValue) {
            console.log(`⏭️ [BOT-SKIP] Não finalizando - SEM prejuízo (R$${currentPrice} ≤ R$${marketValue})`);
            continue;
          }
          
          console.log(`🏁 [BOT-FINALIZE] Finalizando leilão "${auction.title}" - PREJUÍZO DETECTADO`);
          console.log(`   ⚠️ Prejuízo: R$${currentPrice} > R$${marketValue} (diferença: R$${(currentPrice - marketValue).toFixed(2)})`);
          
          await supabase
            .from('auctions')
            .update({
              status: 'finished',
              finished_at: currentTimeBr,
              winner_id: lastBidData.user_id,
              winner_name: profileData.full_name || 'Bot'
            })
            .eq('id', auction.id);

          console.log(`✅ [BOT-FINALIZED] Leilão "${auction.title}" finalizado por prejuízo`);
          finalizedCount++;
        } else {
          console.log(`👤 [BOT-SKIP] Último lance não foi de bot - continuando ativo`);
        }
      }
    }

    // **PROCESSAR LEILÕES INATIVOS (15+ segundos sem lance)**
    if (inactiveAuctions && inactiveAuctions.length > 0) {
      for (const auction of inactiveAuctions) {
        // Pular se já foi processado na lista de risco
        const wasProcessedInRisk = riskAuctions?.some(r => r.id === auction.id) || false;
        if (wasProcessedInRisk) {
          console.log(`⏭️ [INACTIVE-SKIP] Leilão "${auction.title}" já processado na verificação de risco`);
          continue;
        }
        
        console.log(`⏰ [INACTIVE-CHECK] Leilão "${auction.title}" inativo há 15+ segundos`);
        console.log(`🏪 [INACTIVE-CHECK] Preço: R$${auction.current_price} | Loja: R$${auction.market_value} | Meta: R$${auction.company_revenue}/${auction.revenue_target}`);
        
        // Verificar se meta foi atingida
        if (auction.company_revenue >= auction.revenue_target) {
          // Finalizar leilão - meta atingida
          const { data: lastBidData } = await supabase
            .from('bids')
            .select('user_id')
            .eq('auction_id', auction.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { data: winnerProfileData } = await supabase
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
              winner_name: winnerProfileData?.full_name || null
            })
            .eq('id', auction.id);

          console.log(`🏁 [INACTIVE-FINALIZED] Leilão "${auction.title}" finalizado - meta atingida`);
          finalizedCount++;
          
        } else {
          // Verificar se não houve nenhum lance (N8N ou interno) recente - REDUZIDO PARA 12s
          const { data: recentBids } = await supabase
            .from('bids')
            .select('id, cost_paid, profiles!inner(full_name)')
            .eq('auction_id', auction.id)
            .gte('created_at', new Date(Date.now() - 12000).toISOString()) // Últimos 12s (detectar falha N8N)
            .limit(1);

          if (recentBids && recentBids.length > 0) {
            const recentBid = recentBids[0];
            const isN8nBid = recentBid.cost_paid > 0; // N8N bids têm cost_paid > 0
            const isInternalBot = recentBid.cost_paid === 0; // Bots internos têm cost_paid = 0
            
            if (isN8nBid) {
              console.log(`⏭️ [INACTIVE-SKIP] Leilão "${auction.title}" - N8N ativo (último lance há <12s)`);
            } else if (isInternalBot) {
              console.log(`⏭️ [INACTIVE-SKIP] Leilão "${auction.title}" - bot interno recente (aguardando finalização)`);
            }
            continue;
          }

          console.log(`🚨 [N8N-FAILED] Leilão "${auction.title}" - N8N falhou (12+s sem lances) - ativando proteção interna`);

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
              console.log(`🤖 [PROTECTION-INTERNAL] Bot de proteção ativado em "${auction.title}" - N8N falhou (meta não atingida)`);
              botBidsAdded++;
            } else {
              console.error(`❌ [PROTECTION-ERROR] Erro ao ativar proteção: ${bidError.message}`);
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
      risk_auctions_checked: riskAuctions?.length || 0,
      inactive_auctions_checked: inactiveAuctions?.length || 0,
      execution_time_ms: executionTime,
      type: 'protection_system_optimized',
      success: true
    };

    console.log(`✅ [PROTECTION-COMPLETE] Ativados: ${activatedCount} | Finalizados: ${finalizedCount} | Bots: ${botBidsAdded} | Risco: ${riskAuctions?.length || 0} | Inativos: ${inactiveAuctions?.length || 0} | Tempo: ${executionTime}ms`);

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