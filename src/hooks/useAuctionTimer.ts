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
            console.log(`🎯 [FRONTEND-CHECK] Leilão ${auction.id} deve ser ativado - starts_at (BR): ${startsAtDate.toISOString()}, now (BR): ${brazilDate.toISOString()}`);
          }
          
          return shouldActivate;
        }) || [];

        for (const auction of auctionsToActivate) {
          const { error: updateError } = await supabase
            .from('auctions')
            .update({ status: 'active' })
            .eq('id', auction.id);
          
          if (!updateError) {
            console.log(`✅ Leilão ativado (BR): ${auction.title} - Webhook será disparado automaticamente`);
          }
        }

        if (auctionsToActivate.length > 0) {
          onAuctionUpdate();
        }
      } catch (error) {
        console.error('Erro ao verificar status dos leilões:', error);
      }
    };

    // Verificar imediatamente ao carregar
    checkAndActivateWaitingAuctions();

    // Timer para verificar periodicamente
    const statusCheckInterval = setInterval(checkAndActivateWaitingAuctions, 30000);

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [onAuctionUpdate]);
};