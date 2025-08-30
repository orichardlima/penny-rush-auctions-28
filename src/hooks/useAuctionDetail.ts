import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuctionDetail {
  id: string;
  current_price: number;
  total_bids: number;
  time_left: number;
  ends_at: string;
  status: string;
  winner_id?: string;
  winner_name?: string;
}

export const useAuctionDetail = (auctionId?: string) => {
  const [auctionData, setAuctionData] = useState<AuctionDetail | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isWaitingFinalization, setIsWaitingFinalization] = useState(false);
  const [finalizationMessage, setFinalizationMessage] = useState('');
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const finalizationTimeoutRef = useRef<NodeJS.Timeout>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();

  // Mensagens rotativas para aguardar finalização
  const finalizationMessages = [
    'Aguarde um momento',
    'Finalizando leilão',
    'Conferindo lances válidos',
    'Definindo vencedor'
  ];

  // Controla as mensagens rotativas quando aguardando finalização
  useEffect(() => {
    if (!isWaitingFinalization) {
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = undefined;
      }
      return;
    }

    let messageIndex = 0;
    setFinalizationMessage(finalizationMessages[0]);

    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % finalizationMessages.length;
      setFinalizationMessage(finalizationMessages[messageIndex]);
    }, 1000);

    // Timeout de proteção de 15 segundos
    finalizationTimeoutRef.current = setTimeout(() => {
      console.log('⚠️ [FINALIZATION] Timeout de proteção ativado');
      setIsWaitingFinalization(false);
    }, 15000);

    return () => {
      clearInterval(messageInterval);
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
        finalizationTimeoutRef.current = undefined;
      }
    };
  }, [isWaitingFinalization]);

  const fetchAuctionData = useCallback(async () => {
    if (!auctionId) return;
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        console.log(`🎯 [${auctionId}] Timer: ${data.time_left}s | Status: ${data.status} | Source: POLLING`);
        setAuctionData(data);
        setLastSync(new Date());
        
        // Sincronizar timer local com dados do banco
        if (data.status === 'active' && data.time_left > 0) {
          setLocalTimeLeft(data.time_left);
        } else {
          setLocalTimeLeft(null);
        }
        
        // Se leilão foi finalizado, sair do estado de finalização
        if (data.status === 'finished') {
          setIsWaitingFinalization(false);
        } else if (data.status === 'active' && data.time_left === 0) {
          // Leilão ativo com timer zero - mostrar finalização
          setIsWaitingFinalization(true);
        } else if (data.time_left > 0) {
          // Timer ativo - sair da finalização
          setIsWaitingFinalization(false);
        }
      }
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro ao buscar dados:`, error);
    }
  }, [auctionId]);

  useEffect(() => {
    if (!auctionId) return;

    // Buscar dados iniciais
    fetchAuctionData();

    // Configurar realtime
    const channel = supabase
      .channel(`auction-detail-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`
        },
        (payload) => {
          const newData = payload.new as AuctionDetail;
          console.log(`🎯 [${auctionId}] Timer: ${newData.time_left}s | Status: ${newData.status} | Source: REALTIME`);
          
          setAuctionData(newData);
          setLastSync(new Date());
          
          // Sincronizar timer local com dados do realtime
          if (newData.status === 'active' && newData.time_left > 0) {
            setLocalTimeLeft(newData.time_left);
          } else {
            setLocalTimeLeft(null);
          }
          
          // Lógica de finalização baseada no novo sistema
          if (newData.status === 'finished') {
            setIsWaitingFinalization(false);
          } else if (newData.status === 'active' && newData.time_left === 0) {
            setIsWaitingFinalization(true);
          } else if (newData.time_left > 0) {
            setIsWaitingFinalization(false);
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔌 [${auctionId}] Realtime status:`, status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Polling de backup menos frequente
    intervalRef.current = setInterval(fetchAuctionData, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (finalizationTimeoutRef.current) {
        clearTimeout(finalizationTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [auctionId, fetchAuctionData]);

  // Timer visual decremental
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (localTimeLeft !== null && localTimeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [localTimeLeft]);

  const forceSync = useCallback(() => {
    console.log(`🔄 [${auctionId}] Sincronização forçada`);
    fetchAuctionData();
  }, [fetchAuctionData, auctionId]);

  return {
    auctionData,
    isConnected,
    lastSync,
    forceSync,
    isWaitingFinalization,
    finalizationMessage,
    localTimeLeft
  };
};