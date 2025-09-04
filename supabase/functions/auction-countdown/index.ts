import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('⏰ [COUNTDOWN] Iniciando decremento de timers...');
    
    // Executar função para decrementar todos os timers
    const { error: timerError } = await supabaseClient.rpc('decrement_auction_timers');
    
    if (timerError) {
      console.error('❌ [COUNTDOWN-ERROR] Erro ao decrementar timers:', timerError);
      return new Response(JSON.stringify({ 
        error: 'Timer decrement failed', 
        details: timerError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar status atual dos leilões ativos para logging
    const { data: activeAuctions, error: fetchError } = await supabaseClient
      .from('auctions')
      .select('id, title, time_left, status, total_bids')
      .eq('status', 'active')
      .order('time_left', { ascending: true });

    if (fetchError) {
      console.error('⚠️ [COUNTDOWN] Erro ao buscar leilões ativos:', fetchError);
    } else if (activeAuctions) {
      const criticalTimers = activeAuctions.filter(a => a.time_left <= 5);
      
      console.log(`⏰ [COUNTDOWN-STATUS] ${activeAuctions.length} leilões ativos`);
      
      if (criticalTimers.length > 0) {
        console.log(`🚨 [COUNTDOWN-CRITICAL] ${criticalTimers.length} leilões com timer crítico:`);
        criticalTimers.forEach(auction => {
          console.log(`   • "${auction.title}": ${auction.time_left}s restantes (${auction.total_bids} lances)`);
        });
      }
    }

    // Ativar leilões que deveriam ter começado
    const { data: waitingAuctions, error: activateError } = await supabaseClient
      .from('auctions')
      .update({ 
        status: 'active',
        time_left: 15,
        ends_at: new Date(Date.now() + 15000).toISOString()
      })
      .eq('status', 'waiting')
      .lte('starts_at', new Date().toISOString())
      .select('id, title');

    if (activateError) {
      console.error('❌ [COUNTDOWN] Erro ao ativar leilões:', activateError);
    } else if (waitingAuctions && waitingAuctions.length > 0) {
      console.log(`🚀 [COUNTDOWN] Ativados ${waitingAuctions.length} leilões:`);
      waitingAuctions.forEach(auction => {
        console.log(`   • "${auction.title}" (${auction.id})`);
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      timestamp: new Date().toISOString(),
      activeAuctions: activeAuctions?.length || 0,
      criticalTimers: activeAuctions?.filter(a => a.time_left <= 5).length || 0,
      activatedAuctions: waitingAuctions?.length || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [COUNTDOWN-FATAL] Erro fatal na função:', error);
    return new Response(JSON.stringify({ 
      error: 'Fatal countdown error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});