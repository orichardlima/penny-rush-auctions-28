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

    const { company_revenue, revenue_target, title, current_price, market_value, ends_at, max_price, predefined_winner_id } = auction;

    // Helper: gerar display name para last_bidders
    const getBotDisplayName = (bot: any): string => {
      const fullName = bot.full_name || 'Bot';
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
      return parts[0];
    };

    // Helper: verificar se alvo predefinido está liderando
    const isPredefinedWinnerLeading = async (): Promise<boolean> => {
      if (!predefined_winner_id) return false;
      const { data: lastBid } = await supabase
        .from('bids')
        .select('user_id')
        .eq('auction_id', auction_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return lastBid?.user_id === predefined_winner_id;
    };

    // Helper: finalizar com vencedor predefinido (jogador real)
    const finalizeWithPredefinedWinner = async (reason: string, action: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, city, state')
        .eq('user_id', predefined_winner_id)
        .single();

      const winnerName = profile?.city && profile?.state
        ? `${profile.full_name} - ${profile.city}, ${profile.state}`
        : (profile?.full_name || 'Vencedor');

      const displayName = (() => {
        const parts = (profile?.full_name || 'Vencedor').trim().split(' ');
        return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
      })();

      const { data: auctionData } = await supabase
        .from('auctions')
        .select('last_bidders')
        .eq('id', auction_id)
        .single();

      let currentBidders: string[] = auctionData?.last_bidders || [];
      currentBidders = [displayName, ...currentBidders].slice(0, 3);

      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
          winner_id: predefined_winner_id,
          winner_name: winnerName,
          last_bidders: currentBidders
        })
        .eq('id', auction_id);

      if (updateError) throw updateError;

      console.log(`🎯 [PROTECTION] Leilão "${title}" finalizado com alvo predefinido - ${reason} (${winnerName})`);
      return new Response(
        JSON.stringify({ message: reason, action, winner: winnerName, predefined: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // Helper: finalizar com bot como vencedor (REGRA ABSOLUTA)
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
      const botDisplay = getBotDisplayName(bot);

      // Buscar last_bidders atual e prepend o bot vencedor
      const { data: auctionData } = await supabase
        .from('auctions')
        .select('last_bidders')
        .eq('id', auction_id)
        .single();

      let currentBidders: string[] = auctionData?.last_bidders || [];
      currentBidders = [botDisplay, ...currentBidders].slice(0, 3);

      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'finished',
          finished_at: new Date().toISOString(),
          winner_id: bot.user_id,
          winner_name: winnerName,
          last_bidders: currentBidders
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

    // Verificar horário limite
    if (ends_at) {
      const now = new Date();
      if (now >= new Date(ends_at)) {
        return await finalizeWithBot('horário limite atingido', 'finalized_time_limit');
      }
    }

    // Verificar preço máximo
    if (max_price && current_price >= max_price) {
      return await finalizeWithBot('preço máximo atingido', 'finalized_max_price');
    }

    // Verificar meta de receita
    if (company_revenue >= revenue_target) {
      return await finalizeWithBot('meta de receita atingida', 'finalized_revenue_target');
    }

    // Verificar preço > valor de mercado
    if (current_price > market_value) {
      return await finalizeWithBot('proteção contra prejuízo', 'finalized_loss_protection');
    }

    // Meta não atingida - adicionar bid de proteção (bot)
    console.log(`🤖 [PROTECTION] Meta não atingida (R$${company_revenue}/${revenue_target}) - adicionando bid de proteção`);

    const bot = await getRandomBot(supabase);
    if (!bot) {
      return await finalizeWithBot('sem bot para proteção', 'finalized_no_bot');
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
