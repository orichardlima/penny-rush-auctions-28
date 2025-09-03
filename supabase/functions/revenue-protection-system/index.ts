import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Auction {
  id: string;
  title: string;
  status: string;
  revenue_target: number;
  company_revenue: number;
  total_bids: number;
  current_price: number;
  bid_increment: number;
  bid_cost: number;
}

interface BotProfile {
  user_id: string;
  full_name: string;
  is_bot: boolean;
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

    const brazil_now = new Date();
    const sao_paulo_time = brazil_now.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    console.log(`🛡️ [REVENUE-PROTECTION] Iniciando proteção baseada em receita às ${sao_paulo_time} (BR)`);

    // 1. Buscar leilões ativos
    const { data: activeAuctions, error: auctionsError } = await supabase
      .from('auctions')
      .select('id, title, status, revenue_target, company_revenue, total_bids, current_price, bid_increment, bid_cost')
      .eq('status', 'active');

    if (auctionsError) {
      console.error('❌ [REVENUE-PROTECTION] Erro ao buscar leilões:', auctionsError);
      throw auctionsError;
    }

    if (!activeAuctions || activeAuctions.length === 0) {
      console.log('ℹ️ [REVENUE-PROTECTION] Nenhum leilão ativo encontrado');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum leilão ativo',
        timestamp: brazil_now.toISOString(),
        sao_paulo_time: sao_paulo_time
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar um bot aleatório para usar
    const { data: botProfiles, error: botError } = await supabase
      .from('profiles')
      .select('user_id, full_name, is_bot')
      .eq('is_bot', true)
      .limit(1);

    if (botError || !botProfiles || botProfiles.length === 0) {
      console.error('❌ [REVENUE-PROTECTION] Nenhum bot encontrado:', botError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhum bot disponível'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bot = botProfiles[0];
    let protectionActionsCount = 0;
    const protectionResults = [];

    // 3. Analisar cada leilão ativo
    for (const auction of activeAuctions) {
      const revenueDeficit = auction.revenue_target - auction.company_revenue;
      const revenuePercentage = auction.revenue_target > 0 
        ? Math.round((auction.company_revenue / auction.revenue_target) * 100)
        : 0;

      console.log(`📊 [REVENUE-CHECK] Leilão "${auction.title}":`, {
        revenue_target: `R$ ${auction.revenue_target.toFixed(2)}`,
        company_revenue: `R$ ${auction.company_revenue.toFixed(2)}`,
        deficit: `R$ ${revenueDeficit.toFixed(2)}`,
        percentage: `${revenuePercentage}%`,
        total_bids: auction.total_bids
      });

      // 4. SE A RECEITA REAL AINDA NÃO ATINGIU A META -> FORÇAR LANCE BOT
      if (auction.company_revenue < auction.revenue_target) {
        console.log(`🚨 [REVENUE-PROTECTION] Meta não atingida no leilão "${auction.title}" - Forçando lance bot`);
        
        try {
          // Inserir lance do bot para manter o leilão ativo
          const { error: bidError } = await supabase
            .from('bids')
            .insert({
              auction_id: auction.id,
              user_id: bot.user_id,
              bid_amount: auction.current_price + auction.bid_increment,
              cost_paid: auction.bid_cost
            });

          if (bidError) {
            console.error(`❌ [REVENUE-PROTECTION] Erro ao inserir lance bot no leilão ${auction.id}:`, bidError);
            protectionResults.push({
              auction_id: auction.id,
              auction_title: auction.title,
              action: 'failed',
              error: bidError.message,
              deficit: revenueDeficit
            });
          } else {
            protectionActionsCount++;
            console.log(`✅ [REVENUE-PROTECTION] Lance bot inserido com sucesso no leilão "${auction.title}"`);
            protectionResults.push({
              auction_id: auction.id,
              auction_title: auction.title,
              action: 'bot_bid_forced',
              deficit: revenueDeficit,
              new_price: auction.current_price + auction.bid_increment,
              revenue_percentage: revenuePercentage
            });
          }
        } catch (error) {
          console.error(`❌ [REVENUE-PROTECTION] Erro crítico no leilão ${auction.id}:`, error);
          protectionResults.push({
            auction_id: auction.id,
            auction_title: auction.title,
            action: 'critical_error',
            error: error.message,
            deficit: revenueDeficit
          });
        }
      } else {
        console.log(`✅ [REVENUE-OK] Leilão "${auction.title}" com meta atingida (${revenuePercentage}%)`);
        protectionResults.push({
          auction_id: auction.id,
          auction_title: auction.title,
          action: 'target_reached',
          revenue_percentage: revenuePercentage,
          surplus: auction.company_revenue - auction.revenue_target
        });
      }
    }

    const summary = {
      success: true,
      timestamp: brazil_now.toISOString(),
      sao_paulo_time: sao_paulo_time,
      active_auctions: activeAuctions.length,
      protection_actions: protectionActionsCount,
      bot_used: bot.full_name,
      results: protectionResults
    };

    console.log(`🏁 [REVENUE-PROTECTION] Proteção concluída:`, {
      active_auctions: activeAuctions.length,
      protection_actions: protectionActionsCount,
      timestamp: sao_paulo_time
    });

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [REVENUE-PROTECTION] Erro crítico:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});