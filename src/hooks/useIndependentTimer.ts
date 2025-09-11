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
  
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  // Função para limpar polling
  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  // Polling para sincronizar com time_left do backend
  const syncWithBackend = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('time_left, total_bids, status')
        .eq('id', auctionId)
        .single();

      if (error || !data) return;

      // Atualizar status do leilão
      setAuctionStatus(data.status);

      // Se leilão foi finalizado, parar sincronização
      if (data.status === 'finished') {
        console.log(`🏁 [${auctionId}] Leilão finalizado no backend`);
        setBackendTimeLeft(0);
        setIsVerifying(false);
        clearPolling();
        return;
      }

      // Usar o time_left real do backend
      const currentTimeLeft = data.time_left || 0;
      setBackendTimeLeft(currentTimeLeft);

      // Se time_left = 0, mostrar "Verificando lances válidos"
      if (currentTimeLeft === 0 && data.status === 'active') {
        setIsVerifying(true);
        console.log(`🔍 [${auctionId}] Timer em 0 - verificando lances válidos...`);
      } else {
        setIsVerifying(false);
      }

      // Detectar novos lances para logs
      if (data.total_bids > lastBidCount) {
        console.log(`🔄 [${auctionId}] Novo lance detectado! (bids: ${lastBidCount} → ${data.total_bids}) | Timer: ${currentTimeLeft}s`);
        setLastBidCount(data.total_bids);
      }

      console.log(`⏰ [${auctionId}] Sync: ${currentTimeLeft}s | Status: ${data.status} | Verificando: ${currentTimeLeft === 0}`);

    } catch (error) {
      console.error(`❌ [${auctionId}] Erro na sincronização:`, error);
    }
  }, [auctionId, lastBidCount, clearPolling]);

  // Inicialização e polling contínuo
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      console.log(`🚀 [${auctionId}] Inicializando timer sincronizado com backend...`);
      
      try {
        // Primeira sincronização
        await syncWithBackend();
        
        if (isMounted) {
          setIsInitialized(true);
          
          // Iniciar polling de 1 segundo
          pollingIntervalRef.current = setInterval(syncWithBackend, 1000);
          console.log(`✅ [${auctionId}] Polling de sincronização iniciado (1s)`);
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
  }, [auctionId, syncWithBackend, clearPolling]);

  return {
    backendTimeLeft,
    isVerifying,
    isInitialized,
    auctionStatus
  };
};