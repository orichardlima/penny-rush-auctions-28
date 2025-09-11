import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseBackendTimerProps {
  auctionId: string;
}

export const useBackendTimer = ({ auctionId }: UseBackendTimerProps) => {
  const [backendTimeLeft, setBackendTimeLeft] = useState<number>(15);
  const [lastBidCount, setLastBidCount] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [auctionStatus, setAuctionStatus] = useState<string>('active');
  const [lastBidAt, setLastBidAt] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();

  // Função para limpar polling e timers
  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = undefined;
    }
  }, []);

  // Calcular tempo restante baseado em last_bid_at
  const calculateTimeLeft = useCallback((lastBidAtStr: string | null): number => {
    if (!lastBidAtStr) {
      console.log(`⚠️ [${auctionId}] last_bid_at está vazio - assumindo timer em 15s`);
      return 15; // Se não há lances, timer completo
    }
    
    const now = new Date();
    const lastBidTime = new Date(lastBidAtStr);
    const secondsSinceLastBid = Math.floor((now.getTime() - lastBidTime.getTime()) / 1000);
    
    console.log(`🕐 [${auctionId}] CALC: now=${now.toISOString()}, lastBid=${lastBidTime.toISOString()}, diff=${secondsSinceLastBid}s`);
    
    // Se mais de 60 segundos sem atividade, considerar leilão finalizado
    if (secondsSinceLastBid > 60) {
      console.log(`💀 [${auctionId}] Leilão morto - sem atividade há ${secondsSinceLastBid}s`);
      return -1; // Sinalizar que deve ser finalizado
    }
    
    const timeLeft = Math.max(15 - secondsSinceLastBid, 0);
    console.log(`⏰ [${auctionId}] Timer calculado: ${timeLeft}s (${secondsSinceLastBid}s desde último lance)`);
    return timeLeft;
  }, [auctionId]);

  // Polling para sincronizar com backend (menos frequente)
  const syncWithBackend = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('last_bid_at, total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Atualizar status do leilão
      setAuctionStatus(data.status);

      // Se leilão foi finalizado, parar tudo
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado no backend`);
        setBackendTimeLeft(0);
        setIsVerifying(false);
        clearPolling();
        clearTimer();
        return;
      }

      // Atualizar last_bid_at se houver mudança
      if (data.last_bid_at !== lastBidAt) {
        setLastBidAt(data.last_bid_at);
        console.log(`🔄 [${auctionId}] Novo lance detectado! last_bid_at: ${data.last_bid_at}`);
      }

      // Detectar novos lances
      if (data.total_bids > lastBidCount) {
        setLastBidCount(data.total_bids);
      }

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na sincronização:`, error);
    }
  }, [auctionId, lastBidCount, lastBidAt, clearPolling, clearTimer]);

  // Timer local que roda a cada segundo
  const startLocalTimer = useCallback(() => {
    clearTimer(); // Limpar timer anterior
    
    timerIntervalRef.current = setInterval(() => {
      if (auctionStatus !== 'active') return;
      
      const currentTimeLeft = calculateTimeLeft(lastBidAt);
      
      // Se leilão está "morto" (>60s sem atividade), parar processamento
      if (currentTimeLeft === -1) {
        console.log(`💀 [${auctionId}] Leilão considerado finalizado - parando timer`);
        setAuctionStatus('finished');
        setBackendTimeLeft(0);
        setIsVerifying(false);
        clearTimer();
        return;
      }
      
      setBackendTimeLeft(currentTimeLeft);
      
      // Se chegou a 0, mostrar "Verificando lances válidos" por no máximo 30 segundos
      if (currentTimeLeft === 0) {
        setIsVerifying(true);
        console.log(`🔍 [${auctionId}] Timer chegou a 0 - verificando lances válidos...`);
      } else {
        setIsVerifying(false);
      }
      
      console.log(`⏰ [${auctionId}] Timer local: ${currentTimeLeft}s | last_bid_at: ${lastBidAt}`);
    }, 1000);
  }, [auctionStatus, lastBidAt, calculateTimeLeft, clearTimer, auctionId]);

  // Inicialização e polling contínuo
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      console.log(`🚀 [${auctionId}] Inicializando timer baseado em last_bid_at...`);
      
      try {
        // Primeira sincronização
        await syncWithBackend();
        
        if (isMounted) {
          setIsInitialized(true);
          
          // Iniciar timer local a cada segundo
          startLocalTimer();
          
          // Iniciar polling menos frequente (a cada 3 segundos) apenas para detectar novos lances
          pollingIntervalRef.current = setInterval(syncWithBackend, 3000);
          console.log(`✅ [${auctionId}] Timer local e polling iniciados`);
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
      clearPolling();
      clearTimer();
    };
  }, [auctionId, syncWithBackend, clearPolling, startLocalTimer, clearTimer]);

  // Reiniciar timer local quando lastBidAt mudar
  useEffect(() => {
    if (isInitialized && auctionStatus === 'active') {
      startLocalTimer();
    }
  }, [lastBidAt, isInitialized, auctionStatus, startLocalTimer]);

  return {
    backendTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus
  };
};