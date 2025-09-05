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
  time_left: number;
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

    console.log(`🛡️ [REVENUE-PROTECTION] Iniciando proteção ULTRA-RÁPIDA às ${sao_paulo_time} (BR)`);

    // 1. Buscar leilões ativos COM TIMER
    const { data: activeAuctions, error: auctionsError } = await supabase
      .from('auctions')
      .select('id, title, status, revenue_target, company_revenue, total_bids, current_price, bid_increment, bid_cost, time_left')
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

    // 3. Analisar cada leilão ativo COM PRIORIDADE PARA TIMER CRÍTICO
    for (const auction of activeAuctions) {
      const revenueDeficit = auction.revenue_target - auction.company_revenue;
      const revenuePercentage = auction.revenue_target > 0 
        ? Math.round((auction.company_revenue / auction.revenue_target) * 100)
        : 0;

      // 🚨 TIMER CRÍTICO: Checar se timer está baixo (≤ 2 segundos para emergência)
      const isTimerCritical = auction.time_left <= 2 && auction.time_left > 0;
      const needsRevenueProtection = auction.company_revenue < auction.revenue_target;

      console.log(`📊 [ULTRA-FAST-CHECK] Leilão "${auction.title}":`, {
        time_left: `${auction.time_left}s`,
        timer_critical: isTimerCritical ? '🚨 CRÍTICO' : '✅ OK',
        revenue_target: `R$ ${auction.revenue_target.toFixed(2)}`,
        company_revenue: `R$ ${auction.company_revenue.toFixed(2)}`,
        deficit: `R$ ${revenueDeficit.toFixed(2)}`,
        percentage: `${revenuePercentage}%`,
        needs_protection: needsRevenueProtection && isTimerCritical
      });

      // 4. CONDIÇÃO PARA FORÇAR LANCE BOT:
      // APENAS quando timer crítico (≤2s) E meta não atingida
      // Isso permite o timer descer naturalmente até 2s antes de intervir
      if (isTimerCritical && needsRevenueProtection) {
        const reason = 'TIMER CRÍTICO (≤2s) + META NÃO ATINGIDA';
        console.log(`🚨 [EMERGENCY-BID] ${reason} no leilão "${auction.title}" - Forçando lance bot IMEDIATO`);
        
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
            console.error(`❌ [EMERGENCY-BID] Erro ao inserir lance bot no leilão ${auction.id}:`, bidError);
            protectionResults.push({
              auction_id: auction.id,
              auction_title: auction.title,
              action: 'failed',
              error: bidError.message,
              deficit: revenueDeficit,
              time_left: auction.time_left,
              timer_critical: isTimerCritical
            });
          } else {
            protectionActionsCount++;
            console.log(`✅ [EMERGENCY-BID] Lance bot inserido com sucesso no leilão "${auction.title}" (${reason})`);
            protectionResults.push({
              auction_id: auction.id,
              auction_title: auction.title,
              action: isTimerCritical ? 'emergency_timer_bid' : 'revenue_protection_bid',
              reason: reason,
              deficit: revenueDeficit,
              new_price: auction.current_price + auction.bid_increment,
              revenue_percentage: revenuePercentage,
              time_left: auction.time_left,
              timer_critical: isTimerCritical
            });
          }
        } catch (error) {
          console.error(`❌ [EMERGENCY-BID] Erro crítico no leilão ${auction.id}:`, error);
          protectionResults.push({
            auction_id: auction.id,
            auction_title: auction.title,
            action: 'critical_error',
            error: error.message,
            deficit: revenueDeficit,
            time_left: auction.time_left,
            timer_critical: isTimerCritical
          });
        }
      } else {
        const reason = needsRevenueProtection ? 
          `Timer OK (${auction.time_left}s > 2s) - Aguardando timer descer` : 
          `Meta atingida (${revenuePercentage}%)`;
        console.log(`✅ [WAIT] Leilão "${auction.title}" - ${reason}`);
        protectionResults.push({
          auction_id: auction.id,
          auction_title: auction.title,
          action: 'waiting',
          reason: reason,
          revenue_percentage: revenuePercentage,
          surplus: needsRevenueProtection ? revenueDeficit * -1 : auction.company_revenue - auction.revenue_target,
          time_left: auction.time_left,
          timer_critical: isTimerCritical
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

    console.log(`🏁 [ULTRA-FAST-PROTECTION] Proteção URGENTE concluída:`, {
      active_auctions: activeAuctions.length,
      protection_actions: protectionActionsCount,
      emergency_interventions: protectionResults.filter(r => r.action === 'emergency_timer_bid').length,
      revenue_interventions: protectionResults.filter(r => r.action === 'revenue_protection_bid').length,
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