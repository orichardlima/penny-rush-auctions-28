import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAuctionTimer = (onAuctionUpdate: () => void) => {
  useEffect(() => {
    const checkAndActivateWaitingAuctions = async () => {
      try {
        // NOVO: Uso simplificado - o backend já gerencia tudo em horário brasileiro
        const { data: waitingAuctions, error } = await supabase
          .from('auctions')
          .select('*')
          .eq('status', 'waiting');

        if (error) {
          console.error('❌ [FRONTEND] Erro ao buscar leilões aguardando:', error);
          return;
        }

        const nowUTC = new Date();
        const auctionsToActivate = waitingAuctions?.filter(auction => {
          if (!auction.starts_at) return false;
          
          // Comparação simples em UTC - backend converte tudo
          const startsAtDate = new Date(auction.starts_at);
          const shouldActivate = startsAtDate <= nowUTC;
          
          if (shouldActivate) {
            console.log(`🎯 [FRONTEND-ACTIVATE] Leilão ${auction.id} será ativado - starts_at: ${startsAtDate.toISOString()}, now: ${nowUTC.toISOString()}`);
          }
          
          return shouldActivate;
        }) || [];

        for (const auction of auctionsToActivate) {
          const { error: updateError } = await supabase
            .from('auctions')
            .update({ status: 'active' })
            .eq('id', auction.id);
          
          if (!updateError) {
            console.log(`✅ [FRONTEND] Leilão ativado: ${auction.title} - Backend gerencia timer automaticamente`);
          }
        }

        if (auctionsToActivate.length > 0) {
          onAuctionUpdate();
        }
      } catch (error) {
        console.error('❌ [FRONTEND] Erro ao verificar status dos leilões:', error);
      }
    };

    // Verificar imediatamente ao carregar
    checkAndActivateWaitingAuctions();

    // Timer para verificar periodicamente (reduzido - backend faz o trabalho pesado)
    const statusCheckInterval = setInterval(checkAndActivateWaitingAuctions, 60000); // 1 minuto

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [onAuctionUpdate]);
};