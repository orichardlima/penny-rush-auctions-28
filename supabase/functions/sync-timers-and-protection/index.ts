import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Auction {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  time_left: number;
  title: string;
  total_bids: number;
  updated_at: string;
}

interface Bid {
  created_at: string;
  user_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ CORREÇÃO DEFINITIVA TIMEZONE - São Paulo UTC-3 preciso
    const now = new Date();
    
    // Converter para São Paulo usando Intl.DateTimeFormat (mais preciso)
    const saoPauloFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const saoPauloDateString = saoPauloFormatter.format(now).replace(' ', 'T');
    const currentTime = now.toISOString(); // UTC para database
    
    console.log(`🔍 [SYNC] Iniciando sincronização às ${saoPauloDateString} (BR) | UTC: ${currentTime}`);

    // 1. Ativar leilões que estão "waiting" e já passaram do starts_at
    // Buscar todos os leilões waiting e fazer comparação manual com fuso brasileiro
    const { data: waitingAuctions, error: waitingError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, status')
      .eq('status', 'waiting');

    if (waitingError) {
      console.error('Erro ao buscar leilões waiting:', waitingError);
      throw waitingError;
    }

    // ✅ Filtrar leilões que devem ser ativados (timezone corrigido)
    const auctionsToActivate = (waitingAuctions || []).filter(auction => {
      if (!auction.starts_at) return false;
      
      // starts_at vem em UTC do database, comparar diretamente com UTC
      const startsAtDate = new Date(auction.starts_at);
      const shouldActivate = startsAtDate <= now;
      
      if (shouldActivate) {
        console.log(`🎯 [ACTIVATION] Leilão "${auction.title}" deve ser ativado - starts_at: ${startsAtDate.toISOString()}, now: ${now.toISOString()}`);
      }
      
      return shouldActivate;
    });

    let activatedCount = 0;
    for (const auction of auctionsToActivate) {
      console.log(`🚀 [ACTIVATE] Ativando leilão ${auction.id} ("${auction.title}") - starts_at: ${auction.starts_at}`);
      
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          status: 'active',
          time_left: 15,
          updated_at: currentTime
        })
        .eq('id', auction.id);

      if (updateError) {
        console.error(`❌ [ACTIVATION-ERROR] Erro ao ativar leilão ${auction.id}:`, updateError);
      } else {
        activatedCount++;
        console.log(`✅ [ACTIVATED] Leilão "${auction.title}" (${auction.id}) ativado!`);
      }
    }

    // 2. ✅ DECREMENTAR TIMERS e FINALIZAR leilões ativos por inatividade
    const { data: activeAuctions, error: activeError } = await supabase
      .from('auctions')
      .select('id, title, time_left, updated_at, total_bids')
      .eq('status', 'active');

    if (activeError) {
      console.error('❌ [ERROR] Erro ao buscar leilões ativos:', activeError);
      throw activeError;
    }

    let finalizedCount = 0;
    for (const auction of activeAuctions || []) {
      try {
        // Buscar último lance para determinar última atividade
        const { data: lastBids, error: bidError } = await supabase
          .from('bids')
          .select('created_at, user_id')
          .eq('auction_id', auction.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (bidError) {
          console.error(`❌ [BID-ERROR] Erro ao buscar último lance do leilão ${auction.id}:`, bidError);
          continue;
        }

        // ✅ ÚNICA FONTE DE VERDADE: último lance ou updated_at (UTC)
        const lastBidTime = lastBids && lastBids.length > 0 ? lastBids[0].created_at : null;
        const lastActivityTime = lastBidTime || auction.updated_at;
        const lastActivityDate = new Date(lastActivityTime);
        
        // Calcular segundos desde última atividade (UTC)
        const secondsSinceActivity = Math.floor((now.getTime() - lastActivityDate.getTime()) / 1000);
        
        // Calcular novo time_left baseado na inatividade
        const newTimeLeft = Math.max(0, 15 - secondsSinceActivity);
        
        console.log(`⏱️ [TIMER] Leilão "${auction.title}": ${secondsSinceActivity}s inatividade, time_left: ${newTimeLeft}`);

         // ✅ FINALIZAR SE INATIVIDADE >= 15 SEGUNDOS
        if (secondsSinceActivity >= 15) {
          console.log(`🔥 [FORCE-FINALIZE] Finalizando leilão "${auction.title}" com ${secondsSinceActivity}s de inatividade`);
          
          // Buscar ganhador (último lance)
          let winnerId = null;
          let winnerName = 'Nenhum ganhador';
          
          if (lastBids && lastBids.length > 0) {
            winnerId = lastBids[0].user_id;
            
            // Buscar nome do ganhador
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', winnerId)
              .single();
            
            winnerName = profile?.full_name || `Usuário ${winnerId.substring(0, 8)}`;
          }

          // ✅ FINALIZAR LEILÃO COM RETRY EM CASO DE FALHA
          let attemptCount = 0;
          let finalizeSuccess = false;
          
          while (!finalizeSuccess && attemptCount < 3) {
            attemptCount++;
            console.log(`🔄 [FINALIZE-ATTEMPT-${attemptCount}] Tentativa ${attemptCount} de finalização do leilão ${auction.id}`);
            
            const { error: finalizeError } = await supabase
              .from('auctions')
              .update({
                status: 'finished',
                time_left: 0,
                winner_id: winnerId,
                winner_name: winnerName,
                finished_at: currentTime,
                updated_at: currentTime
              })
              .eq('id', auction.id);

            if (!finalizeError) {
              finalizedCount++;
              finalizeSuccess = true;
              console.log(`🏁 [FINALIZED] Leilão "${auction.title}" finalizado com sucesso! Ganhador: "${winnerName}" (${secondsSinceActivity}s inatividade)`);
            } else {
              console.error(`❌ [FINALIZE-ERROR-${attemptCount}] Tentativa ${attemptCount} falhou:`, finalizeError);
              if (attemptCount >= 3) {
                console.error(`💀 [FINALIZE-FAILED] FALHA CRÍTICA: Não foi possível finalizar leilão ${auction.id} após 3 tentativas`);
              }
            }
          }
        }
        // ❌ REMOVIDO: Não mais atualiza timers visuais para evitar sincronização
        // Os timers agora são controlados APENAS pelos triggers individuais de bid

      } catch (error) {
        console.error(`❌ [PROCESSING-ERROR] Erro ao processar leilão ${auction.id}:`, error);
      }
    }

    // 3. ✅ PROTEÇÃO: reverter leilões ativos prematuros (sem lances e starts_at futuro)
    const { data: allActiveAuctions, error: allActiveError } = await supabase
      .from('auctions')
      .select('id, title, starts_at, total_bids')
      .eq('status', 'active');

    if (allActiveError) {
      console.error('❌ [ERROR] Erro ao buscar todos os leilões ativos:', allActiveError);
      throw allActiveError;
    }

    // Identificar leilões prematuros (ativos mas starts_at no futuro E sem lances)
    const prematureAuctions = (allActiveAuctions || []).filter(auction => {
      if (!auction.starts_at) return false;
      
      const startsAtDate = new Date(auction.starts_at);
      const isPremature = startsAtDate > now && auction.total_bids === 0;
      
      if (isPremature) {
        console.log(`⚠️ [PROTECTION] Leilão ${auction.id} é prematuro - starts_at: ${startsAtDate.toISOString()}, now: ${now.toISOString()}, total_bids: ${auction.total_bids}`);
      }
      
      return isPremature;
    });

    let revertedCount = 0;
    for (const auction of prematureAuctions) {
      const { error: revertError } = await supabase
        .from('auctions')
        .update({
          status: 'waiting',
          time_left: 15,
          updated_at: currentTime
        })
        .eq('id', auction.id);

      if (!revertError) {
        revertedCount++;
        console.log(`🔄 [REVERTED] Leilão prematuro "${auction.title}" revertido para 'waiting'`);
      } else {
        console.error(`❌ [REVERT-ERROR] Erro ao reverter leilão ${auction.id}:`, revertError);
      }
    }

    // ✅ RESULTADO FINAL
    const result = {
      timestamp: currentTime,
      sao_paulo_time: saoPauloDateString,
      waiting_auctions: waitingAuctions?.length || 0,
      activated_count: activatedCount,
      active_auctions: activeAuctions?.length || 0,
      finalized_count: finalizedCount,
      premature_auctions: prematureAuctions.length,
      reverted_count: revertedCount,
      success: true
    };

    console.log(`🏁 [SYNC] Sincronização concluída:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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