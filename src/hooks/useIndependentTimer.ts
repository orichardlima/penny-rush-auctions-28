import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseBackendTimerProps {
  auctionId: string;
}

export const useBackendTimer = ({ auctionId }: UseBackendTimerProps) => {
  const [localTimeLeft, setLocalTimeLeft] = useState<number>(15);
  const [backendTimeLeft, setBackendTimeLeft] = useState<number>(15);
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [auctionStatus, setAuctionStatus] = useState<string>('active');
  const [lastBidAt, setLastBidAt] = useState<string | null>(null);
  
  const localTimerRef = useRef<NodeJS.Timeout>();
  const syncIntervalRef = useRef<NodeJS.Timeout>();

  // Limpar timers
  const clearTimers = useCallback(() => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = undefined;
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = undefined;
    }
  }, []);

  // Iniciar timer local que decrementa a cada 1 segundo
  const startLocalTimer = useCallback((initialTime: number) => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    setLocalTimeLeft(initialTime);
    console.log(`⏰ [${auctionId}] Timer local iniciado: ${initialTime}s`);

    localTimerRef.current = setInterval(() => {
      setLocalTimeLeft(prev => {
        const newTime = Math.max(0, prev - 1);
        console.log(`🕒 [${auctionId}] Timer local: ${prev}s → ${newTime}s`);
        
        if (newTime === 0) {
          console.log(`⚠️ [${auctionId}] Timer local chegou a 0 - Verificando lances válidos`);
          setIsVerifying(true);
        }
        
        return newTime;
      });
    }, 1000);
  }, [auctionId]);

  // Sincronizar com backend
  const syncWithBackend = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('time_left, last_bid_at, total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) {
        console.error(`❌ [${auctionId}] Erro ao buscar dados:`, error);
        return;
      }

      const currentBackendTime = data.time_left || 0;
      console.log(`🔄 [${auctionId}] Sync: backend=${currentBackendTime}s, local=${localTimeLeft}s, status=${data.status}`);

      // Atualizar status do leilão
      setAuctionStatus(data.status);
      setBackendTimeLeft(currentBackendTime);

      // Se leilão foi finalizado, parar tudo
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado`);
        setIsVerifying(false);
        clearTimers();
        return;
      }

      // Detectar novos lances
      const hadNewBid = data.last_bid_at !== lastBidAt || data.total_bids > lastBidCount;
      
      if (hadNewBid) {
        setLastBidAt(data.last_bid_at);
        setLastBidCount(data.total_bids);
        console.log(`🆕 [${auctionId}] Novo lance detectado! Resetando timer para ${currentBackendTime}s`);
        
        // Reset imediato do timer local quando há novo lance
        if (currentBackendTime > 0) {
          setIsVerifying(false);
          startLocalTimer(currentBackendTime);
        }
      } else if (currentBackendTime > 0 && Math.abs(currentBackendTime - localTimeLeft) > 2) {
        // Sincronizar timer local se diferença > 2 segundos
        console.log(`🔄 [${auctionId}] Sincronizando timer: local=${localTimeLeft}s → backend=${currentBackendTime}s`);
        setIsVerifying(false);
        startLocalTimer(currentBackendTime);
      }

      // Lógica do "Verificando lances válidos"
      if (currentBackendTime === 0 && data.last_bid_at) {
        const timeSinceLastBid = Math.floor((new Date().getTime() - new Date(data.last_bid_at).getTime()) / 1000);
        
        if (timeSinceLastBid < 30) {
          console.log(`⏳ [${auctionId}] Verificando lances válidos - ${timeSinceLastBid}s desde último lance`);
          setIsVerifying(true);
        } else {
          console.log(`💀 [${auctionId}] Leilão sem atividade há ${timeSinceLastBid}s`);
          setIsVerifying(false);
        }
      }

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na sincronização:`, error);
    }
  }, [auctionId, lastBidAt, lastBidCount, localTimeLeft, startLocalTimer, clearTimers]);

  // Iniciar sincronização a cada 3 segundos
  const startBackendSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    syncIntervalRef.current = setInterval(() => {
      if (auctionStatus !== 'finished') {
        syncWithBackend();
      }
    }, 3000);
    
    console.log(`⚡ [${auctionId}] Sincronização backend iniciada (3s)`);
  }, [auctionStatus, syncWithBackend, auctionId]);

  // Inicialização
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      console.log(`🚀 [${auctionId}] Inicializando timer híbrido local...`);
      
      try {
        // Primeira sincronização
        await syncWithBackend();
        
        if (isMounted) {
          setIsInitialized(true);
          startBackendSync();
          console.log(`✅ [${auctionId}] Timer híbrido inicializado`);
        }
      } catch (error) {
        console.error(`❌ [${auctionId}] Erro na inicialização:`, error);
        if (isMounted) {
          setIsInitialized(true);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      clearTimers();
    };
  }, [auctionId, syncWithBackend, startBackendSync, clearTimers]);

  // Retornar o timer local como valor principal
  const displayTimeLeft = localTimeLeft > 0 ? localTimeLeft : (isVerifying ? 0 : 0);

  console.log(`⏰ [${auctionId}] Display: ${displayTimeLeft}s | Verificando: ${isVerifying} | Status: ${auctionStatus}`);

  return {
    backendTimeLeft: displayTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus
  };
};