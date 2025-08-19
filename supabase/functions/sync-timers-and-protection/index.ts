import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      auctions: {
        Row: {
          id: string;
          status: string;
          starts_at: string;
          ends_at: string;
          time_left: number;
          title: string;
          total_bids: number;
        };
      };
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Usar fuso brasileiro para todas as operações
    const brazilTimezone = 'America/Sao_Paulo';
    const now = new Date();
    const brazilDate = new Date(now.toLocaleString("en-US", {timeZone: brazilTimezone}));
    const currentTime = brazilDate.toISOString();
    
    console.log(`🔍 [SYNC] Iniciando sincronização às ${currentTime} (BR)`);

    // 1. Ativar leilões que estão "waiting" e já passaram do starts_at
    const { data: waitingAuctions, error: waitingError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, status')
      .eq('status', 'waiting')
      .lte('starts_at', currentTime);

    if (waitingError) {
      console.error('Erro ao buscar leilões waiting:', waitingError);
      throw waitingError;
    }

    let activatedCount = 0;
    for (const auction of waitingAuctions || []) {
      console.log(`🚀 [ACTIVATE] Ativando leilão ${auction.id} ("${auction.title}") - starts_at: ${auction.starts_at}`);
      
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          ends_at: new Date(brazilDate.getTime() + 15000).toISOString(), // 15 segundos a partir de agora (BR)
          time_left: 15,
          updated_at: currentTime
        })
        .eq('id', auction.id);

      if (updateError) {
        console.error(`Erro ao ativar leilão ${auction.id}:`, updateError);
      } else {
        activatedCount++;
        console.log(`✅ [ACTIVATE] Leilão ${auction.id} ativado com sucesso!`);
      }
    }

    // 2. Sincronizar time_left de leilões ativos baseado no ends_at
    const { data: activeAuctions, error: activeError } = await supabase
      .from('auctions')
      .select('id, title, ends_at, time_left')
      .eq('status', 'active')
      .not('ends_at', 'is', null);

    if (activeError) {
      console.error('Erro ao buscar leilões ativos:', activeError);
      throw activeError;
    }

    let syncedCount = 0;
    for (const auction of activeAuctions || []) {
      const endsAt = new Date(auction.ends_at);
      const timeLeftInSeconds = Math.max(0, Math.floor((endsAt.getTime() - brazilDate.getTime()) / 1000));
      
      if (timeLeftInSeconds !== auction.time_left) {
        const { error: syncError } = await supabase
          .from('auctions')
          .update({
            time_left: timeLeftInSeconds,
            updated_at: currentTime
          })
          .eq('id', auction.id);

        if (syncError) {
          console.error(`Erro ao sincronizar timer do leilão ${auction.id}:`, syncError);
        } else {
          syncedCount++;
          console.log(`⏰ [SYNC] Leilão ${auction.id} sincronizado: time_left=${timeLeftInSeconds}s`);
        }
      }
    }

    // 3. Proteção: verificar se há leilões que não deveriam estar ativos
    const { data: prematureAuctions, error: prematureError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, status, total_bids')
      .eq('status', 'active')
      .gt('starts_at', currentTime)
      .eq('total_bids', 0); // Só revertir se não houver lances

    if (prematureError) {
      console.error('Erro ao buscar leilões prematuros:', prematureError);
    } else {
      let revertedCount = 0;
      for (const auction of prematureAuctions || []) {
        console.log(`⚠️ [PROTECT] Leilão ${auction.id} está ativo prematuramente! Revertendo para waiting...`);
        
        const { error: revertError } = await supabase
          .from('auctions')
          .update({
            status: 'waiting',
            ends_at: null,
            time_left: 15,
            updated_at: currentTime
          })
          .eq('id', auction.id);

        if (revertError) {
          console.error(`Erro ao reverter leilão ${auction.id}:`, revertError);
        } else {
          revertedCount++;
          console.log(`🔒 [PROTECT] Leilão ${auction.id} revertido para waiting`);
        }
      }
      
      if (revertedCount > 0) {
        console.log(`🔒 [PROTECT] ${revertedCount} leilões revertidos para waiting`);
      }
    }

    const summary = {
      timestamp: currentTime,
      waiting_auctions: waitingAuctions?.length || 0,
      activated_count: activatedCount,
      active_auctions: activeAuctions?.length || 0,
      synced_count: syncedCount,
      premature_auctions: prematureAuctions?.length || 0,
      reverted_count: prematureAuctions?.length || 0
    };

    console.log(`🏁 [SYNC] Sincronização concluída:`, summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronização de timers concluída',
        ...summary
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na sincronização de timers:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});