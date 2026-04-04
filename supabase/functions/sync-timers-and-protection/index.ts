import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getRandomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRandomBot(supabase: any) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recentWinnerIds } = await supabase
    .from('auctions')
    .select('winner_id')
    .eq('status', 'finished')
    .not('winner_id', 'is', null)
    .gte('finished_at', cutoff);

  const excludeIds = (recentWinnerIds || []).map((r: any) => r.winner_id);

  const { data: bots } = await supabase
    .from('profiles')
    .select('user_id, full_name, city, state')
    .eq('is_bot', true);

  if (!bots || bots.length === 0) return null;

  const availableBots = bots.filter((b: any) => !excludeIds.includes(b.user_id));
  const pool = availableBots.length > 0 ? availableBots : bots;
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatBotWinnerName(bot: any): string {
  if (bot.city && bot.state) {
    return `${bot.full_name} - ${bot.city}, ${bot.state}`;
  }
  return bot.full_name || 'Bot';
}

function getBotDisplayName(bot: any): string {
  const fullName = bot.full_name || 'Bot';
  const parts = fullName.trim().split(' ');
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

// Helper: finalizar leilão SEMPRE com bot como vencedor
// Inclui finish_reason e filtro idempotente (status=active AND finished_at IS NULL)
async function finalizeWithBot(
  supabase: any, auctionId: string, auctionTitle: string, 
  reason: string, finishReason: string
): Promise<boolean> {
  const bot = await getRandomBot(supabase);
  if (!bot) {
    console.error(`❌ [FINALIZE] Nenhum bot disponível para "${auctionTitle}"`);
    return false;
  }

  const winnerName = formatBotWinnerName(bot);
  const botDisplay = getBotDisplayName(bot);

  const { data: auctionData } = await supabase
    .from('auctions')
    .select('last_bidders')
    .eq('id', auctionId)
    .single();

  let currentBidders: string[] = auctionData?.last_bidders || [];
  currentBidders = [botDisplay, ...currentBidders].slice(0, 3);

  const { error, data } = await supabase
    .from('auctions')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      winner_id: bot.user_id,
      winner_name: winnerName,
      last_bidders: currentBidders,
      finish_reason: finishReason
    })
    .eq('id', auctionId)
    .eq('status', 'active')
    .is('finished_at', null)
    .select('id');

  if (error) {
    console.error(`❌ [FINALIZE] Erro ao finalizar "${auctionTitle}":`, error.message);
    return false;
  }

  // Se nenhuma linha foi atualizada, outra camada já finalizou
  if (!data || data.length === 0) {
    console.log(`⚡ [FINALIZE] "${auctionTitle}" já foi finalizado por outra camada`);
    return false;
  }

  console.log(`🏁 [FINALIZED] "${auctionTitle}" - ${reason} | finish_reason=${finishReason} (bot: ${winnerName})`);
  return true;
}

async function distributeFuryVault(supabase: any, auctionId: string, auctionTitle: string) {
  try {
    const { data, error } = await supabase.rpc('fury_vault_distribute', { p_auction_id: auctionId });
    if (error) {
      console.error(`❌ [FURY-VAULT] Erro ao distribuir cofre do leilão "${auctionTitle}":`, error.message);
    } else if (data?.status === 'distributed') {
      console.log(`🏆 [FURY-VAULT] Cofre distribuído para "${auctionTitle}"`);
    }
  } catch (e) {
    console.error(`💥 [FURY-VAULT] Exceção ao distribuir cofre:`, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const currentTimeBr = new Date().toISOString();
    console.log(`🔄 [PROTECTION-CHECK] ${currentTimeBr}`);
    const startTime = Date.now();

    // **FASE 1: Ativar leilões em espera cujo horário chegou**
    const { data: waitingAuctions } = await supabase
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
    let safetyNetFinalized = 0;

    if (activeAuctions && activeAuctions.length > 0) {
      const shuffledAuctions = [...activeAuctions].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < shuffledAuctions.length; i++) {
        const auction = shuffledAuctions[i];
        
        if (i > 0) {
          const delay = getRandomDelay(1000, 4000);
          await sleep(delay);
        }

        const lastBidTime = new Date(auction.last_bid_at).getTime();
        const currentTime = Date.now();
        const secondsSinceLastBid = Math.floor((currentTime - lastBidTime) / 1000);

        // 1. Verificar horário limite
        if (auction.ends_at) {
          const endsAt = new Date(auction.ends_at).getTime();
          if (currentTime >= endsAt) {
            const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'horário limite', 'time_limit');
            if (finalized) {
              await distributeFuryVault(supabase, auction.id, auction.title);
              finalizedCount++;
            }
            continue;
          }
        }

        // 2. Verificar preço máximo
        if (auction.max_price && Number(auction.current_price) >= Number(auction.max_price)) {
          const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'preço máximo', 'max_price');
          if (finalized) {
            await distributeFuryVault(supabase, auction.id, auction.title);
            finalizedCount++;
          }
          continue;
        }

        // 3. Verificar meta de receita
        if (Number(auction.company_revenue) >= Number(auction.revenue_target)) {
          const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'meta atingida', 'revenue_target');
          if (finalized) {
            await distributeFuryVault(supabase, auction.id, auction.title);
            finalizedCount++;
          }
          continue;
        }

        // 4. SAFETY NET: Inatividade > 30s — finalizar com bot
        if (secondsSinceLastBid > 30) {
          console.log(`🚨 [INATIVIDADE] "${auction.title}" - ${secondsSinceLastBid}s sem lance, finalizando com BOT`);
          const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'inatividade', 'inactivity_forced');
          if (finalized) {
            await distributeFuryVault(supabase, auction.id, auction.title);
            finalizedCount++;
            safetyNetFinalized++;
          }
          continue;
        }

        // 5. LANCE PROBABILÍSTICO para manter leilão ativo
        {
          const bidProbability = secondsSinceLastBid >= 13 ? 1.0
            : secondsSinceLastBid >= 10 ? 0.25
            : 0;
          
          if (bidProbability === 0 || Math.random() > bidProbability) {
            continue;
          }

          const currentPrice = Number(auction.current_price);
          const marketValue = Number(auction.market_value);

          // CONTROLE ANTI-SPAM
          const { data: recentBot } = await supabase
            .from('bids')
            .select('id')
            .eq('auction_id', auction.id)
            .eq('cost_paid', 0)
            .gte('created_at', new Date(Date.now() - 3000).toISOString())
            .limit(1);

          if (recentBot && recentBot.length > 0) {
            continue;
          }

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
                const finalized = await finalizeWithBot(supabase, auction.id, auction.title, 'prejuízo evitado', 'loss_protection');
                if (finalized) {
                  await distributeFuryVault(supabase, auction.id, auction.title);
                  finalizedCount++;
                }
              }
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
      safety_net_finalized: safetyNetFinalized,
      bot_bids_added: botBidsAdded,
      auctions_checked: activeAuctions?.length || 0,
      execution_time_ms: executionTime,
      type: 'protection_system_bot_only',
      success: true
    };

    console.log(`✅ [COMPLETE] Ativados:${activatedCount} | Finalizados:${finalizedCount} (safety:${safetyNetFinalized}) | Bots:${botBidsAdded} | ${executionTime}ms`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 [ERROR] Erro crítico:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal error', 
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
