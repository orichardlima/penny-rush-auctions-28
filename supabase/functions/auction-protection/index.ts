import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { auction_id } = await req.json();

    if (!auction_id) {
      return new Response(
        JSON.stringify({ error: 'auction_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🛡️ [PROTECTION] Iniciando verificação para leilão ${auction_id}`);

    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', auction_id)
      .single();

    if (auctionError || !auction) {
      return new Response(
        JSON.stringify({ error: 'Leilão não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (auction.status !== 'active') {
      return new Response(
        JSON.stringify({ message: 'Leilão não está ativo', action: 'ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      company_revenue,
      revenue_target,
      title,
      current_price,
      market_value,
      ends_at,
      max_price,
      predefined_winner_id,
      predefined_winner_ids,
      open_win_mode,
      min_bids_to_qualify,
    } = auction as any;

    const predefinedIds: string[] = Array.isArray(predefined_winner_ids) && predefined_winner_ids.length > 0
      ? predefined_winner_ids
      : (predefined_winner_id ? [predefined_winner_id] : []);

    // Helper: gerar display name (primeiros dois nomes)
    const getDisplayName = (fullName: string | null | undefined): string => {
      const parts = (fullName || 'Vencedor').trim().split(' ');
      return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
    };

    // Retorna o user_id do líder elegível ou null
    // Elegível = (a) está em predefinedIds, OU (b) open_win_mode=true + é real + tem >= min_bids
    const getEligibleRealLeader = async (): Promise<string | null> => {
      const { data: lastBid } = await supabase
        .from('bids')
        .select('user_id')
        .eq('auction_id', auction_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastBid?.user_id) return null;
      const leaderId = lastBid.user_id;

      // Regra 1: predefinido
      if (predefinedIds.includes(leaderId)) return leaderId;

      // Regra 2: open_win_mode
      if (open_win_mode === true) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_bot')
          .eq('user_id', leaderId)
          .single();

        if (profile && profile.is_bot === false) {
          const minBids = Number(min_bids_to_qualify || 0);
          if (minBids <= 0) return leaderId;

          const { count } = await supabase
            .from('bids')
            .select('id', { count: 'exact', head: true })
            .eq('auction_id', auction_id)
            .eq('user_id', leaderId);

          if ((count || 0) >= minBids) return leaderId;
        }
      }

      return null;
    };

    // Finaliza com qualquer usuário real elegível
    const finalizeWithRealUser = async (userId: string, reason: string, action: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, city, state')
        .eq('user_id', userId)
        .single();

      const winnerName = profile?.city && profile?.state
        ? `${profile.full_name} - ${profile.city}, ${profile.state}`
        : (profile?.full_name || 'Vencedor');

      const displayName = getDisplayName(profile?.full_name);

      const { data: auctionData } = await supabase
        .from('auctions')
        .select('last_bidders')
        .eq('id', auction_id)
        .single();

      let currentBidders: string[] = (auctionData?.last_bidders as any) || [];
      currentBidders = [displayName, ...currentBidders].slice(0, 3);

      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
          winner_id: userId,
          winner_name: winnerName,
          last_bidders: currentBidders,
        })
        .eq('id', auction_id);

      if (updateError) throw updateError;

      const isPredefined = predefinedIds.includes(userId);
      console.log(`🎯 [PROTECTION] Leilão "${title}" finalizado com ${isPredefined ? 'alvo predefinido' : 'usuário real elegível'} - ${reason} (${winnerName})`);
      return new Response(
        JSON.stringify({ message: reason, action, winner: winnerName, predefined: isPredefined, open_win: !isPredefined }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // Helper: finalizar com bot como vencedor
    const finalizeWithBot = async (reason: string, action: string) => {
      const bot = await getRandomBot(supabase);
      if (!bot) {
        console.error(`❌ [PROTECTION] Nenhum bot disponível`);
        return new Response(
          JSON.stringify({ error: 'Nenhum bot disponível' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const winnerName = formatBotWinnerName(bot);
      const botDisplay = getDisplayName(bot.full_name);

      const { data: auctionData } = await supabase
        .from('auctions')
        .select('last_bidders')
        .eq('id', auction_id)
        .single();

      let currentBidders: string[] = (auctionData?.last_bidders as any) || [];
      currentBidders = [botDisplay, ...currentBidders].slice(0, 3);

      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
          winner_id: bot.user_id,
          winner_name: winnerName,
          last_bidders: currentBidders,
        })
        .eq('id', auction_id);

      if (updateError) {
        console.error(`❌ [PROTECTION] Erro ao finalizar:`, updateError);
        throw updateError;
      }

      console.log(`✅ [PROTECTION] Leilão "${title}" finalizado - ${reason} (bot: ${winnerName})`);
      return new Response(
        JSON.stringify({ message: reason, action, winner: winnerName }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // Helper unificado: escolhe finalizar com real elegível (se liderando) ou bot
    const finalize = async (reason: string, action: string) => {
      const eligibleLeader = await getEligibleRealLeader();
      if (eligibleLeader) {
        return await finalizeWithRealUser(eligibleLeader, reason, action);
      }
      return await finalizeWithBot(reason, action);
    };

    // Verificar horário limite
    if (ends_at) {
      const now = new Date();
      if (now >= new Date(ends_at)) {
        return await finalize('horário limite atingido', 'finalized_time_limit');
      }
    }

    // Verificar preço máximo
    if (max_price && current_price >= max_price) {
      return await finalize('preço máximo atingido', 'finalized_max_price');
    }

    // Verificar meta de receita
    if (company_revenue >= revenue_target) {
      return await finalize('meta de receita atingida', 'finalized_revenue_target');
    }

    // Verificar preço > valor de mercado
    if (current_price > market_value) {
      return await finalize('proteção contra prejuízo', 'finalized_loss_protection');
    }

    // Se há real elegível liderando, NÃO injetar bid de bot
    const eligibleLeader = await getEligibleRealLeader();
    if (eligibleLeader) {
      console.log(`🎯 [PROTECTION] "${title}" - real elegível lidera (${eligibleLeader}), bots pausados`);
      return new Response(
        JSON.stringify({
          message: 'Real elegível lidera - bots pausados',
          action: 'bot_paused_real_leading',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Meta não atingida - adicionar bid de proteção (bot)
    console.log(`🤖 [PROTECTION] Meta não atingida (R$${company_revenue}/${revenue_target}) - adicionando bid de proteção`);

    const bot = await getRandomBot(supabase);
    if (!bot) {
      return await finalize('sem bot para proteção', 'finalized_no_bot');
    }

    const { error: bidError } = await supabase
      .from('bids')
      .insert({
        auction_id: auction_id,
        user_id: bot.user_id,
        bid_amount: current_price + auction.bid_increment,
        cost_paid: 0
      });

    if (bidError) {
      // Se foi bloqueado pelo trigger (real elegível lidera), tratar como sucesso silencioso
      if (bidError.message?.includes('BOT_BLOCKED_PREDEFINED_WINNER_LEADING')) {
        console.log(`🎯 [PROTECTION] Bid bloqueado pelo trigger - real elegível lidera`);
        return new Response(
          JSON.stringify({ message: 'Bot bloqueado - real elegível lidera', action: 'bot_blocked_by_trigger' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error(`❌ [PROTECTION] Erro ao inserir bid:`, bidError);
      throw bidError;
    }

    console.log(`🤖 [PROTECTION] Bid de proteção adicionado ao leilão "${title}"`);
    return new Response(
      JSON.stringify({ 
        message: 'Bid de proteção adicionado', 
        action: 'bot_bid_added',
        revenue_status: `R$${company_revenue}/${revenue_target}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [PROTECTION] Erro crítico:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
