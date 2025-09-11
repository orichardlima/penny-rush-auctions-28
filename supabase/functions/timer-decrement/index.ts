import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log(`⏰ [TIMER-DECREMENT] Decrementando timers - ${currentTimeBr}`);

    // **DECREMENTAR TIME_LEFT DE TODOS OS LEILÕES ATIVOS**
    const { data: activeAuctions, error: fetchError } = await supabase
      .from('auctions')
      .select('id, title, time_left, company_revenue, revenue_target')
      .eq('status', 'active');

    if (fetchError) {
      console.error('❌ Erro ao buscar leilões ativos:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let decrementedCount = 0;
    let protectionTriggered = 0;

    if (activeAuctions && activeAuctions.length > 0) {
      for (const auction of activeAuctions) {
        const currentTimeLeft = auction.time_left || 0;
        
        if (currentTimeLeft > 0) {
          // Decrementar timer normalmente
          const newTimeLeft = Math.max(currentTimeLeft - 1, 0);
          
          await supabase
            .from('auctions')
            .update({
              time_left: newTimeLeft,
              updated_at: currentTimeBr
            })
            .eq('id', auction.id);
          
          console.log(`⏰ [DECREMENT] ${auction.title}: ${currentTimeLeft}s → ${newTimeLeft}s`);
          decrementedCount++;
          
          // Se chegou a 0, acionar sistema de proteção
          if (newTimeLeft === 0) {
            console.log(`🛡️ [PROTECTION-TRIGGER] Timer zerou para "${auction.title}" - acionando proteção`);
            
            // Chamar edge function de proteção
            try {
              await supabase.functions.invoke('auction-protection', {
                body: { auction_id: auction.id }
              });
              protectionTriggered++;
            } catch (protectionError) {
              console.error(`❌ [PROTECTION-ERROR] Falha ao acionar proteção para ${auction.id}:`, protectionError);
            }
          }
        }
      }
    }

    const summary = {
      timestamp: currentTimeBr,
      decremented: decrementedCount,
      protection_triggered: protectionTriggered,
      success: true
    };

    console.log(`✅ [TIMER-COMPLETE] Decrementados: ${decrementedCount} | Proteção acionada: ${protectionTriggered}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 [TIMER-ERROR] Erro crítico no decremento:', error);
    return new Response(JSON.stringify({ 
      error: 'Timer decrement error', 
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});