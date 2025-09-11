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
  const [backendTimerValue, setBackendTimerValue] = useState<number>(15);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  // Função para limpar polling
  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  // Lógica híbrida: Priorizar time_left do backend, usar last_bid_at como auxiliar
  const calculateDisplayTimer = useCallback((dbTimeLeft: number, lastBidAtStr: string | null): { timeLeft: number, showVerifying: boolean } => {
    // PRIORIDADE 1: Se time_left do backend > 0, usar ele diretamente
    if (dbTimeLeft > 0) {
      console.log(`✅ [${auctionId}] Usando time_left do backend: ${dbTimeLeft}s`);
      return { timeLeft: dbTimeLeft, showVerifying: false };
    }
    
    // PRIORIDADE 2: Se time_left = 0, verificar last_bid_at para lógica de "verificando"
    if (dbTimeLeft === 0 && lastBidAtStr) {
      const now = new Date();
      const lastBidTime = new Date(lastBidAtStr);
      const secondsSinceLastBid = Math.floor((now.getTime() - lastBidTime.getTime()) / 1000);
      
      console.log(`🔍 [${auctionId}] time_left=0, verificando last_bid_at: ${secondsSinceLastBid}s atrás`);
      
      // Se menos de 30 segundos desde último lance, mostrar "Verificando lances válidos"
      if (secondsSinceLastBid < 30) {
        console.log(`⏳ [${auctionId}] Mostrando "Verificando lances válidos" - ${secondsSinceLastBid}s desde último lance`);
        return { timeLeft: 0, showVerifying: true };
      } else {
        console.log(`💀 [${auctionId}] Leilão realmente morto - ${secondsSinceLastBid}s sem atividade`);
        return { timeLeft: 0, showVerifying: false };
      }
    }
    
    // FALLBACK: Se não há last_bid_at ou time_left é 0, mostrar timer zerado
    console.log(`⚠️ [${auctionId}] Fallback: time_left=${dbTimeLeft}, last_bid_at=${lastBidAtStr ? 'sim' : 'não'}`);
    return { timeLeft: 0, showVerifying: false };
  }, [auctionId]);

  // Sincronização PRIORITÁRIA com time_left do backend
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

      console.log(`🔄 [${auctionId}] Sync backend: time_left=${data.time_left}, status=${data.status}, last_bid_at=${data.last_bid_at}`);

      // Atualizar status do leilão
      setAuctionStatus(data.status);

      // Se leilão foi finalizado, parar tudo
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado no backend`);
        setBackendTimeLeft(0);
        setIsVerifying(false);
        clearPolling();
        return;
      }

      // CRÍTICO: Atualizar time_left do backend (fonte da verdade)
      setBackendTimerValue(data.time_left || 0);

      // Atualizar last_bid_at se houver mudança (para detectar novos lances)
      if (data.last_bid_at !== lastBidAt) {
        setLastBidAt(data.last_bid_at);
        console.log(`🆕 [${auctionId}] Novo lance detectado! last_bid_at: ${data.last_bid_at}`);
      }

      // Detectar novos lances pelo count
      if (data.total_bids > lastBidCount) {
        setLastBidCount(data.total_bids);
        console.log(`📈 [${auctionId}] Total bids aumentou: ${lastBidCount} → ${data.total_bids}`);
      }

      // Aplicar lógica híbrida para display
      const { timeLeft, showVerifying } = calculateDisplayTimer(data.time_left || 0, data.last_bid_at);
      setBackendTimeLeft(timeLeft);
      setIsVerifying(showVerifying);

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na sincronização:`, error);
    }
  }, [auctionId, lastBidCount, lastBidAt, clearPolling, calculateDisplayTimer]);

  // Polling contínuo a cada 1 segundo para sincronização máxima
  const startContinuousSync = useCallback(() => {
    clearPolling();
    
    pollingIntervalRef.current = setInterval(async () => {
      if (auctionStatus === 'finished') {
        clearPolling();
        return;
      }
      
      await syncWithBackend();
    }, 1000); // Sincronização a cada 1 segundo para máxima responsividade
    
    console.log(`⚡ [${auctionId}] Sincronização contínua iniciada (1s)`);
  }, [auctionStatus, syncWithBackend, clearPolling, auctionId]);

  // Inicialização e sincronização contínua
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      console.log(`🚀 [${auctionId}] Inicializando timer híbrido (time_left + last_bid_at)...`);
      
      try {
        // Primeira sincronização para obter estado inicial
        await syncWithBackend();
        
        if (isMounted) {
          setIsInitialized(true);
          
          // Iniciar sincronização contínua a cada 1 segundo
          startContinuousSync();
          
          console.log(`✅ [${auctionId}] Timer híbrido inicializado com sucesso`);
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
    };
  }, [auctionId, syncWithBackend, clearPolling, startContinuousSync]);

  // Monitorar mudanças nos lances para restart imediato da sincronização
  useEffect(() => {
    if (isInitialized && auctionStatus === 'active') {
      // Quando detectar novo lance, forçar sincronização imediata
      if (lastBidCount > 0) {
        console.log(`🔄 [${auctionId}] Novo lance detectado, forçando sincronização...`);
        syncWithBackend();
      }
    }
  }, [lastBidCount, isInitialized, auctionStatus, syncWithBackend, auctionId]);

  return {
    backendTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus
  };
};