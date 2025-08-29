import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAuctionTimer = (onAuctionUpdate: () => void) => {
  useEffect(() => {
    const checkAndActivateWaitingAuctions = async () => {
      try {
        const brazilTimezone = 'America/Sao_Paulo';
        // Usar fuso brasileiro para comparações
        const nowInBrazil = new Date().toLocaleString("en-US", {timeZone: brazilTimezone});
        const brazilDate = new Date(nowInBrazil);
        
        const { data: waitingAuctions, error } = await supabase
          .from('auctions')
          .select('*')
          .eq('status', 'waiting');

        if (error) {
          console.error('Erro ao buscar leilões aguardando:', error);
          return;
        }

        const auctionsToActivate = waitingAuctions?.filter(auction => {
          if (!auction.starts_at) return false;
          
          // Converter starts_at para fuso brasileiro para comparação precisa
          const startsAtBrazil = new Date(auction.starts_at).toLocaleString("en-US", {timeZone: brazilTimezone});
          const startsAtDate = new Date(startsAtBrazil);
          
          const shouldActivate = startsAtDate <= brazilDate;
          
          if (shouldActivate) {
            console.log(`🎯 [FRONTEND-ACTIVATE] Leilão ${auction.id} deve ser ativado - starts_at (BR): ${startsAtDate.toISOString()}, now (BR): ${brazilDate.toISOString()}`);
          }
          
          return shouldActivate;
        }) || [];

        for (const auction of auctionsToActivate) {
          const { error: updateError } = await supabase
            .from('auctions')
            .update({ status: 'active' })
            .eq('id', auction.id);
          
          if (!updateError) {
            console.log(`✅ [FRONTEND-ACTIVATE] Leilão ativado: ${auction.title} - Sistema backend gerenciará finalização por inatividade`);
          }
        }

        if (auctionsToActivate.length > 0) {
          onAuctionUpdate();
        }
      } catch (error) {
        console.error('Erro ao verificar status dos leilões:', error);
      }
    };

    // NOVA LÓGICA: Frontend só ativa leilões aguardando
    // Finalização é responsabilidade EXCLUSIVA do backend por inatividade de lances
    console.log('🔄 [FRONTEND-TIMER] Frontend gerencia apenas ativação - finalização é por inatividade no backend');

    // Verificar imediatamente ao carregar
    checkAndActivateWaitingAuctions();

    // Timer para verificar periodicamente (pode ser menos frequente)
    const statusCheckInterval = setInterval(checkAndActivateWaitingAuctions, 60000); // 1 minuto

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [onAuctionUpdate]);
};