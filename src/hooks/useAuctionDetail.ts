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

  // Verificar se leilão deve ser finalizado quando timer chega a zero
  const checkForFinalization = useCallback(async () => {
    if (!auctionId || !auctionData || auctionData.status !== 'active') return;

    console.log(`🏁 [FINALIZATION-CHECK] Timer zerou para leilão ${auctionId}, verificando últimos lances...`);
    
    try {
      // Buscar último lance para confirmar inatividade
      const { data: lastBids, error } = await supabase
        .from('bids')
        .select('created_at')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao verificar últimos lances:', error);
        return;
      }

      const now = new Date();
      const lastBidTime = lastBids && lastBids.length > 0 ? new Date(lastBids[0].created_at) : null;
      const secondsSinceLastBid = lastBidTime ? Math.floor((now.getTime() - lastBidTime.getTime()) / 1000) : Infinity;

      console.log(`🔍 [FINALIZATION-CHECK] Último lance há ${secondsSinceLastBid}s`);

      // Se não há lances recentes (15+ segundos), finalizar via Edge Function
      if (secondsSinceLastBid >= 15) {
        console.log(`✅ [FINALIZATION-START] Iniciando finalização do leilão ${auctionId}`);
        setIsWaitingFinalization(true);
        
        try {
          // Chamar Edge Function para finalizar leilão
          const { error: functionError } = await supabase.functions.invoke('finalize-auction', {
            body: { auction_id: auctionId }
          });

          if (functionError) {
            console.error('Erro ao chamar Edge Function de finalização:', functionError);
          } else {
            console.log(`🎯 [FINALIZATION] Edge Function chamada com sucesso para ${auctionId}`);
          }
        } catch (error) {
          console.error('Erro ao finalizar leilão:', error);
        }
        
        // Forçar sincronização para pegar o status atualizado
        setTimeout(() => fetchAuctionData(), 1000);
      } else {
        console.log(`⏳ [FINALIZATION-WAIT] Lance muito recente (${secondsSinceLastBid}s), aguardando...`);
        // Se houve lance recente, resetar timer para continuar
        setLocalTimeLeft(15 - secondsSinceLastBid);
      }
    } catch (error) {
      console.error('Erro ao verificar finalização:', error);
    }
  }, [auctionId, auctionData, fetchAuctionData]);

  // Timer visual decremental com finalização automática
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (localTimeLeft !== null && localTimeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setLocalTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            // Timer chegou a zero - verificar se deve finalizar
            checkForFinalization();
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
  }, [localTimeLeft, checkForFinalization]);

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