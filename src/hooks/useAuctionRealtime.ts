import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuctionUpdate {
  id: string;
  current_price: number;
  total_bids: number;
  time_left: number;
  ends_at: string;
  status: string;
  winner_id?: string;
  winner_name?: string;
}

interface BidUpdate {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  created_at: string;
}

export const useAuctionRealtime = (auctionId?: string) => {
  const [auctionData, setAuctionData] = useState<AuctionUpdate | null>(null);
  const [recentBids, setRecentBids] = useState<BidUpdate[]>([]);
  const [localTimeLeft, setLocalTimeLeft] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const localTimerRef = useRef<NodeJS.Timeout>();
  const channelsRef = useRef<any[]>([]);
  const isActiveRef = useRef(true);

  // Timer local para contagem regressiva visual
  useEffect(() => {
    if (!isActiveRef.current || localTimeLeft === null || localTimeLeft <= 0) {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
      }
      return;
    }

    localTimerRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      
      setLocalTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        console.log(`⏰ [TIMER] ${prev - 1}s restantes`);
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
      }
    };
  }, [localTimeLeft]);

  // Fetch inicial dos dados
  const fetchAuctionData = useCallback(async () => {
    if (!auctionId || !isActiveRef.current) return;
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();
      
      if (error) throw error;
      
      if (isActiveRef.current) {
        console.log('🔄 [SYNC] Dados atualizados do banco:', {
          auction_id: data.id,
          time_left: data.time_left,
          status: data.status,
          timestamp: new Date().toISOString()
        });
        
        setAuctionData(data);
        setLocalTimeLeft(data.time_left || 0); // Sincronizar timer local
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('❌ [SYNC] Erro ao buscar dados:', error);
    }
  }, [auctionId]);

  // Setup realtime
  useEffect(() => {
    if (!auctionId) return;

    isActiveRef.current = true;
    console.log('🔄 Configurando realtime para leilão:', auctionId);
    
    // Fetch inicial
    fetchAuctionData();

    // Canal para updates do leilão
    const auctionChannel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`
        },
        (payload) => {
          if (!isActiveRef.current) return;
          
          console.log('📡 [REALTIME] Update do leilão recebido:', payload);
          const newAuctionData = payload.new as AuctionUpdate;
          setAuctionData(newAuctionData);
          setLocalTimeLeft(newAuctionData.time_left || 0); // Resetar timer local
          setLastSync(new Date());
          setIsConnected(true);
          
          // Log detalhado para debug
          console.log('🕐 [REALTIME] Timer atualizado via banco:', {
            auction_id: newAuctionData.id,
            time_left: newAuctionData.time_left,
            local_timer_reset: true,
            current_price: newAuctionData.current_price,
            total_bids: newAuctionData.total_bids,
            status: newAuctionData.status,
            timestamp: new Date().toISOString()
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Status do canal auction:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    // Canal para novos lances
    const bidsChannel = supabase
      .channel(`bids-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auctionId}`
        },
        (payload) => {
          if (!isActiveRef.current) return;
          
          console.log('🎯 Novo lance recebido:', payload);
          const newBid = payload.new as BidUpdate;
          setRecentBids(prev => [newBid, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    channelsRef.current = [auctionChannel, bidsChannel];

    // Polling de backup a cada 30 segundos
    const pollingInterval = setInterval(() => {
      if (isActiveRef.current && !isConnected) {
        console.log('🔄 [POLLING] Fazendo backup sync');
        fetchAuctionData();
      }
    }, 30000);

    // Cleanup
    return () => {
      isActiveRef.current = false;
      console.log('🔌 Desconectando realtime channels');
      
      if (localTimerRef.current) {
        clearInterval(localTimerRef.current);
      }
      
      clearInterval(pollingInterval);
      
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      
      setIsConnected(false);
    };
  }, [auctionId, fetchAuctionData]);

  // Função para forçar sincronização
  const forceSync = useCallback(() => {
    console.log('🔄 [FORCE] Sincronização forçada pelo usuário');
    fetchAuctionData();
  }, [fetchAuctionData]);

  // Retornar timer local se disponível, senão usar o do banco
  const displayTimeLeft = localTimeLeft !== null ? localTimeLeft : auctionData?.time_left;

  return {
    auctionData: auctionData ? { ...auctionData, time_left: displayTimeLeft || 0 } : null,
    recentBids,
    isConnected,
    lastSync,
    forceSync
  };
};