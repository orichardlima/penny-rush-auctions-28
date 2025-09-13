import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseBackendTimerProps {
  auctionId: string;
}

export const useBackendTimer = ({ auctionId }: UseBackendTimerProps) => {
  const [localTimeLeft, setLocalTimeLeft] = useState<number>(0);
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [auctionStatus, setAuctionStatus] = useState<string>('active');
  const [lastBidAt, setLastBidAt] = useState<string | null>(null);
  
  const localTimerRef = useRef<NodeJS.Timeout>();
  const bidCheckIntervalRef = useRef<NodeJS.Timeout>();
  const lastVerifyingStart = useRef<number>();

  // Limpar timers
  const clearTimers = useCallback(() => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = undefined;
    }
    if (bidCheckIntervalRef.current) {
      clearInterval(bidCheckIntervalRef.current);
      bidCheckIntervalRef.current = undefined;
    }
  }, []);

  // Iniciar timer local autônomo que decrementa a cada 1 segundo
  const startLocalTimer = useCallback((initialTime: number) => {
    console.log(`🚀 [${auctionId}] Iniciando timer autônomo: ${initialTime}s`);
    
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    setLocalTimeLeft(initialTime);
    setIsVerifying(false);

    localTimerRef.current = setInterval(() => {
      setLocalTimeLeft(prev => {
        const newTime = Math.max(0, prev - 1);
        console.log(`⏰ [${auctionId}] Timer: ${prev}s → ${newTime}s`);
        
        if (newTime === 0) {
          console.log(`🔚 [${auctionId}] Timer chegou a 0 - Verificando lances válidos`);
          setIsVerifying(true);
          lastVerifyingStart.current = Date.now();
        }
        
        return newTime;
      });
    }, 1000);
  }, [auctionId]);

  // Verificar novos lances a cada 1 segundo
  const checkForNewBids = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('last_bid_at, total_bids, status, time_left, current_price')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Se leilão foi finalizado, parar todos os timers
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado`);
        setAuctionStatus('finished');
        setIsVerifying(false);
        clearTimers();
        return;
      }

      // Se está verificando há muito tempo, forçar refresh do status
      if (isVerifying && localTimeLeft === 0) {
        const timeSinceVerifying = Date.now() - (lastVerifyingStart.current || Date.now());
        if (timeSinceVerifying > 5000) { // 5 segundos
          console.log(`⏰ [${auctionId}] Timeout na verificação, forçando refresh...`);
          setIsVerifying(false);
          startLocalTimer(15); // Resetar timer
        }
      }

      // Detectar novos lances
      const hadNewBid = data.last_bid_at !== lastBidAt || data.total_bids > lastBidCount;
      
      if (hadNewBid) {
        setLastBidAt(data.last_bid_at);
        setLastBidCount(data.total_bids);
        console.log(`🆕 [${auctionId}] NOVO LANCE! Resetando timer para 15s`);
        
        // Emitir evento customizado para notificar o AuctionCard
        const resetEvent = new CustomEvent('auction-timer-reset', {
          detail: {
            auctionId,
            newPrice: data.current_price,
            newBidCount: data.total_bids,
            lastBidAt: data.last_bid_at
          }
        });
        window.dispatchEvent(resetEvent);
        
        // Reset do timer para 15 segundos em caso de novo lance
        startLocalTimer(15);
      }

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao verificar novos lances:`, error);
    }
  }, [auctionId, lastBidAt, lastBidCount, startLocalTimer, clearTimers, isVerifying, localTimeLeft]);

  // Inicialização do sistema
  const initialize = useCallback(async () => {
    try {
      console.log(`🔄 [${auctionId}] Inicializando sistema de timer...`);
      
      const { data, error } = await supabase
        .from('auctions')
        .select('time_left, last_bid_at, total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) {
        console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
        return;
      }

      // Definir estado inicial
      setLastBidAt(data.last_bid_at);
      setLastBidCount(data.total_bids);
      setAuctionStatus(data.status);

      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão já finalizado`);
        setIsVerifying(false);
        return;
      }

      // Iniciar timer local com time_left do backend
      const initialTime = data.time_left || 15;
      console.log(`⚡ [${auctionId}] Iniciando com ${initialTime}s do backend`);
      startLocalTimer(initialTime);

      // Iniciar verificação de novos lances a cada 500ms (tempo real)
      bidCheckIntervalRef.current = setInterval(checkForNewBids, 500);
      console.log(`👀 [${auctionId}] Verificação de lances iniciada (500ms)`);

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
    }
  }, [auctionId, startLocalTimer, checkForNewBids]);

  // Integração com Page Visibility API para forçar sync após inatividade
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized) {
        console.log(`👀 [${auctionId}] Usuário voltou à aba, forçando verificação...`);
        checkForNewBids();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [auctionId, isInitialized, checkForNewBids]);

  // Effect de inicialização
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      await initialize();
      if (isMounted) {
        setIsInitialized(true);
      }
    };

    init();

    return () => {
      isMounted = false;
      clearTimers();
    };
  }, [auctionId, initialize, clearTimers]);

  console.log(`📊 [${auctionId}] Estado: timer=${localTimeLeft}s | verificando=${isVerifying} | status=${auctionStatus}`);

  return {
    backendTimeLeft: localTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus
  };
};