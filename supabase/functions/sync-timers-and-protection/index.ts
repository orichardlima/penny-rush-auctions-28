import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para gerar delay aleatório em ms
function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}

// Função sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: buscar bot aleatório com nome formatado
async function getRandomBot(supabase: any) {
  const { data: bots } = await supabase
    .from('profiles')
    .select('user_id, full_name, city, state')
    .eq('is_bot', true);

  if (!bots || bots.length === 0) return null;
  return bots[Math.floor(Math.random() * bots.length)];
}

function formatBotWinnerName(bot: any): string {
  if (bot.city && bot.state) {
    return `${bot.full_name} - ${bot.city}, ${bot.state}`;
  }
  return bot.full_name || 'Bot';
}

// Helper: gerar display name para last_bidders (formato "Primeiro Segundo")
function getBotDisplayName(bot: any): string {
  const fullName = bot.full_name || 'Bot';
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

// Helper: finalizar leilão SEMPRE com bot como vencedor
async function finalizeWithBot(supabase: any, auctionId: string, auctionTitle: string, reason: string) {
  const bot = await getRandomBot(supabase);
  if (!bot) {
    console.error(`❌ [FINALIZE] Nenhum bot disponível para "${auctionTitle}"`);
    return false;
  }

  const winnerName = formatBotWinnerName(bot);
  const botDisplay = getBotDisplayName(bot);

  // Buscar last_bidders atual e prepend o bot vencedor
  const { data: auctionData } = await supabase
    .from('auctions')
    .select('last_bidders')
    .eq('id', auctionId)
    .single();

  let currentBidders: string[] = auctionData?.last_bidders || [];
  currentBidders = [botDisplay, ...currentBidders].slice(0, 3);

  const { error } = await supabase
    .from('auctions')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      winner_id: bot.user_id,
      winner_name: winnerName,
      last_bidders: currentBidders
    })
    .eq('id', auctionId);

  if (error) {
    console.error(`❌ [FINALIZE] Erro ao finalizar "${auctionTitle}":`, error.message);
    return false;
  }

  console.log(`🏁 [FINALIZED] "${auctionTitle}" - ${reason} (bot: ${winnerName})`);
  return true;
}

// Helper: distribute fury vault for a finalized auction
async function distributeFuryVault(supabase: any, auctionId: string, auctionTitle: string) {
  try {
    const { data, error } = await supabase.rpc('fury_vault_distribute', { p_auction_id: auctionId });
    if (error) {
      console.error(`❌ [FURY-VAULT] Erro ao distribuir cofre do leilão "${auctionTitle}":`, error.message);
    } else if (data?.status === 'distributed') {
      console.log(`🏆 [FURY-VAULT] Cofre distribuído para "${auctionTitle}": top=R$${data.top_bidder_amount}, sorteio=R$${data.raffle_winner_amount}, qualificados=${data.qualified_count}`);
    } else {
      console.log(`📦 [FURY-VAULT] Cofre "${auctionTitle}": ${data?.status}`);
    }
  } catch (e) {
    console.error(`💥 [FURY-VAULT] Exceção ao distribuir cofre:`, e);
  }
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
          last_bid_at: currentTimeBr,
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
    .select('id, title, current_price, market_value, company_revenue, revenue_target, last_bid_at, bid_increment, ends_at, max_price')
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
    // Embaralhar ordem para variar qual leilão é processado primeiro
    const shuffledAuctions = [...activeAuctions].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffledAuctions.length; i++) {
      const auction = shuffledAuctions[i];
      
      // Delay aleatório entre leilões para dessincronizar
      if (i > 0) {
        const delay = getRandomDelay(1000, 4000);
        console.log(`⏳ [DELAY] Aguardando ${delay}ms antes de processar "${auction.title}"`);
        await sleep(delay);
      }

      // Calcular tempo desde último lance
      const lastBidTime = new Date(auction.last_bid_at).getTime();
      const currentTime = Date.now();
      const secondsSinceLastBid = Math.floor((currentTime - lastBidTime) / 1000);

      console.log(`⏰ [CHECK] Leilão "${auction.title}": ${secondsSinceLastBid}s inativo`);

      // Verificar se horário limite foi atingido
      if (auction.ends_at) {
        const endsAt = new Date(auction.ends_at).getTime();
        if (currentTime >= endsAt) {
          console.log(`⏰ [HORÁRIO-LIMITE] Leilão "${auction.title}" - horário limite atingido, finalizando com BOT`);
          
          const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'horário limite');
          if (finalized) {
            await distributeFuryVault(supabase, auction.id, auction.title);
            finalizedCount++;
          }
          continue;
        }
      }

      // Verificar se preço máximo foi atingido
      if (auction.max_price && Number(auction.current_price) >= Number(auction.max_price)) {
        console.log(`💰 [PREÇO-MÁXIMO] Leilão "${auction.title}" - preço máximo R$${auction.max_price} atingido, finalizando com BOT`);
        
        const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'preço máximo');
        if (finalized) {
          await distributeFuryVault(supabase, auction.id, auction.title);
          finalizedCount++;
        }
        continue;
      }

      // Verificar se meta foi atingida - finalizar independente de inatividade
      if (Number(auction.company_revenue) >= Number(auction.revenue_target)) {
        console.log(`🎯 [META-OK] Leilão "${auction.title}" - meta atingida, finalizando com BOT`);
        
        const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'meta atingida');
        if (finalized) {
          await distributeFuryVault(supabase, auction.id, auction.title);
          finalizedCount++;
        }
        continue;
      }

      // LANCE PROBABILÍSTICO: threshold e probabilidade variáveis por leilão
      {
      const bidProbability = secondsSinceLastBid >= 13 ? 1.0
          : secondsSinceLastBid >= 10 ? 0.25
          : 0;
        
        if (bidProbability === 0 || Math.random() > bidProbability) {
          if (secondsSinceLastBid >= 10) {
            console.log(`🎲 [NATURAL] "${auction.title}" - ${secondsSinceLastBid}s inativo, aguardando próximo ciclo`);
          }
          continue;
        }
        const currentPrice = Number(auction.current_price);
        const marketValue = Number(auction.market_value);

        // CONTROLE ANTI-SPAM: Verificar se já foi adicionado bot nos últimos 3s
        const { data: recentBot } = await supabase
          .from('bids')
          .select('id')
          .eq('auction_id', auction.id)
          .eq('cost_paid', 0)
          .gte('created_at', new Date(Date.now() - 3000).toISOString())
          .limit(1);

        if (recentBot && recentBot.length > 0) {
          console.log(`🚫 [ANTI-SPAM] Leilão "${auction.title}" - bot já adicionado recentemente`);
          continue;
        }

        // ADICIONAR UM BOT PARA MANTER ATIVO
        const { data: randomBot } = await supabase.rpc('get_random_bot');
        
        if (randomBot) {
          const newPrice = currentPrice + Number(auction.bid_increment);
          
          const { error: bidError } = await supabase
            .from('bids')
            .insert({
              auction_id: auction.id,
              user_id: randomBot,
              bid_amount: newPrice,
              cost_paid: 0
            });

          if (!bidError) {
            botBidsAdded++;
            
            // SE HÁ PREJUÍZO - finalizar imediatamente com BOT
            if (currentPrice > marketValue) {
              console.log(`💰 [PREJUÍZO] Finalizando "${auction.title}" com BOT - R$${currentPrice} > R$${marketValue}`);
              
              const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'prejuízo evitado');
              if (finalized) {
                await distributeFuryVault(supabase, auction.id, auction.title);
                finalizedCount++;
              }
            } else {
              console.log(`🤖 [REAQUECER] Bot reaqueceu "${auction.title}" - R$${newPrice.toFixed(2)} - continuando`);
            }
          } else {
            console.error(`❌ [ERRO] Falha ao adicionar bot: ${bidError.message}`);
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
    auctions_checked: activeAuctions?.length || 0,
    execution_time_ms: executionTime,
    type: 'protection_system_bot_only',
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
