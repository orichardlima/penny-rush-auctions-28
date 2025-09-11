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
  const [isInitialized, setIsInitialized] = useState(false);
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const protectionTimeoutRef = useRef<NodeJS.Timeout>();

  // Função para limpar todos os intervalos e timeouts
  const clearAllTimers = useCallback(() => {
    [timerIntervalRef, pollingIntervalRef, protectionTimeoutRef].forEach(ref => {
      if (ref.current) {
        clearInterval(ref.current);
        clearTimeout(ref.current);
        ref.current = undefined;
      }
    });
  }, []);

  // Função para resetar timer manualmente (apenas para debugging)
  const resetTimer = useCallback(async () => {
    console.log(`🔄 [${auctionId}] Reset manual do timer`);
    
    try {
      // Buscar dados atuais do leilão
      const { data: auction } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();
      
      if (auction && auction.status === 'active') {
        setLastBidCount(auction.total_bids);
        setLocalTimer(15); // Sempre resetar para 15s em leilões ativos
        console.log(`✅ [${auctionId}] Timer resetado para 15s`);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no reset manual:`, error);
    }
  }, [auctionId]);


  // Polling para detectar novos lances e finalização do leilão
  const checkForNewBids = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Se leilão foi finalizado no backend, parar timer
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado no backend`);
        setLocalTimer(0);
        clearAllTimers();
        return;
      }

      // Se houve novos lances, resetar timer para 15s
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! Timer reseta para 15s (bids: ${lastBidCount} → ${data.total_bids})`);
        setLocalTimer(15);
        setLastBidCount(data.total_bids);
        setIsProtectionActive(false);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no polling:`, error);
    }
  }, [auctionId, lastBidCount, clearAllTimers]);

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
        setIsProtectionActive(false);
      } else {
        console.log(`✅ [${auctionId}] Sistema de proteção acionado com sucesso`);
        
        // Aguardar 2 segundos para o backend processar e polling detectar mudanças
        protectionTimeoutRef.current = setTimeout(() => {
          setIsProtectionActive(false);
        }, 2000);
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao acionar proteção:`, error);
      setIsProtectionActive(false);
    }
  }, [auctionId, isProtectionActive]);

  // Timer decremental visual
  useEffect(() => {
    clearAllTimers();

    if (isInitialized) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimer(prev => {
          const newValue = Math.max(prev - 1, 0);
          console.log(`⏰ [${auctionId}] Timer local: ${newValue}s${newValue === 0 ? ' (ZERO!)' : ''}`);
          
          if (newValue === 0 && prev > 0) {
            // Timer chegou a zero - acionar proteção
            triggerProtection();
          }
          
          return newValue;
        });
      }, 1000);
    }

    return clearAllTimers;
  }, [isInitialized, auctionId, triggerProtection, clearAllTimers]);

  // Inicialização e polling
  useEffect(() => {
    let isMounted = true;
    
    const initializeTimer = async () => {
      console.log(`🚀 [${auctionId}] Inicializando timer...`);
      
      try {
        // Buscar dados do leilão
        const { data, error } = await supabase
          .from('auctions')
          .select('total_bids, status')
          .eq('id', auctionId)
          .single();

        if (!isMounted) return;

        if (data && !error) {
          setLastBidCount(data.total_bids);
          
          if (data.status === 'finished') {
            console.log(`🏁 [${auctionId}] Leilão já finalizado`);
            setLocalTimer(0);
          } else if (data.status === 'active') {
            // Para leilões ativos, sempre iniciar em 15s
            setLocalTimer(15);
            console.log(`✅ [${auctionId}] Timer inicializado: 15s`);
          } else {
            setLocalTimer(0);
            console.log(`⏹️ [${auctionId}] Leilão inativo: ${data.status}`);
          }
        }
      } catch (error) {
        console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
        if (isMounted) {
          setLocalTimer(initialTimeLeft);
        }
      } finally {
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    // Inicializar
    initializeTimer();

    // Iniciar polling após inicialização
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(checkForNewBids, 1000);
    };

    if (isInitialized) {
      startPolling();
    }

    return () => {
      isMounted = false;
      clearAllTimers();
    };
  }, [auctionId, checkForNewBids, initialTimeLeft, isInitialized, clearAllTimers]);

  return {
    localTimer,
    isProtectionActive,
    isInitialized,
    resetTimer
  };
};