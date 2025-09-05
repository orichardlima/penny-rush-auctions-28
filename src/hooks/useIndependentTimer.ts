import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseIndependentTimerProps {
  auctionId: string;
  initialTimeLeft?: number;
}

export const useIndependentTimer = ({ auctionId, initialTimeLeft = 15 }: UseIndependentTimerProps) => {
  const [localTimer, setLocalTimer] = useState(initialTimeLeft);
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isProtectionActive, setIsProtectionActive] = useState(false);
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  // Polling para detectar novos lances a cada 1 segundo
  const checkForNewBids = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Se houve novos lances, resetar timer
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! Resetando timer para 15s (bids: ${lastBidCount} → ${data.total_bids})`);
        setLocalTimer(15);
        setLastBidCount(data.total_bids);
        setIsProtectionActive(false);
      }

      // Se leilão foi finalizado, parar timer
      if (data.status === 'finished') {
        setLocalTimer(0);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no polling:`, error);
    }
  }, [auctionId, lastBidCount]);

  // Chamar edge function de proteção quando timer chega a zero
  const triggerProtection = useCallback(async () => {
    if (isProtectionActive) return;
    
    setIsProtectionActive(true);
    console.log(`🛡️ [${auctionId}] Timer zerou! Acionando sistema de proteção...`);

    try {
      const { error } = await supabase.functions.invoke('auction-protection', {
        body: { auction_id: auctionId }
      });

      if (error) {
        console.error(`❌ [${auctionId}] Erro na edge function de proteção:`, error);
      } else {
        console.log(`✅ [${auctionId}] Sistema de proteção acionado com sucesso`);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao acionar proteção:`, error);
    }
  }, [auctionId, isProtectionActive]);

  // Timer decremental visual (independente do backend)
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (localTimer > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimer(prev => {
          const newValue = prev - 1;
          console.log(`⏰ [${auctionId}] Timer local: ${newValue}s`);
          
          if (newValue === 0) {
            // Timer chegou a zero - acionar proteção
            triggerProtection();
          }
          
          return newValue;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [localTimer, auctionId, triggerProtection]);

  // Polling para detectar novos lances (independente do timer)
  useEffect(() => {
    // Buscar contagem inicial de lances
    const initializeBidCount = async () => {
      try {
        const { data, error } = await supabase
          .from('auctions')
          .select('total_bids')
          .eq('id', auctionId)
          .single();

        if (data && !error) {
          setLastBidCount(data.total_bids);
        }
      } catch (error) {
        console.error(`❌ [${auctionId}] Erro ao inicializar contagem:`, error);
      }
    };

    initializeBidCount();

    // Polling a cada 1 segundo para detectar novos lances
    pollingIntervalRef.current = setInterval(checkForNewBids, 1000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [auctionId, checkForNewBids]);

  return {
    localTimer,
    isProtectionActive
  };
};