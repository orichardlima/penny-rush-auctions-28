import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();
  
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const channelsRef = useRef<any[]>([]);

  // Fetch inicial e polling de backup
  const fetchAuctionData = useCallback(async () => {
    if (!auctionId) return;
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();
      
      if (error) throw error;
      
      console.log('🔄 [SYNC] Dados atualizados do banco:', {
        auction_id: data.id,
        time_left: data.time_left,
        status: data.status,
        timestamp: new Date().toISOString()
      });
      
      setAuctionData(data);
      setLastSync(new Date());
    } catch (error) {
      console.error('❌ [SYNC] Erro ao buscar dados:', error);
    }
  }, [auctionId]);

  // Setup realtime com heartbeat e reconexão
  useEffect(() => {
    if (!auctionId) return;

    console.log('🔄 Configurando realtime para leilão:', auctionId);
    
    let isSubscribed = true;

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
          if (!isSubscribed) return;
          
          console.log('📡 [REALTIME] Update do leilão recebido:', payload);
          const newAuctionData = payload.new as AuctionUpdate;
          setAuctionData(newAuctionData);
          setLastSync(new Date());
          setIsConnected(true);
          
          // Log detalhado para debug
          console.log('🕐 [REALTIME] Timer atualizado via banco:', {
            auction_id: newAuctionData.id,
            time_left: newAuctionData.time_left,
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
          if (!isSubscribed) return;
          
          console.log('🎯 Novo lance recebido:', payload);
          const newBid = payload.new as BidUpdate;
          setRecentBids(prev => [newBid, ...prev.slice(0, 9)]);
        }
      )
      .subscribe();

    channelsRef.current = [auctionChannel, bidsChannel];

    // Heartbeat para verificar conexão
    heartbeatRef.current = setInterval(() => {
      const now = new Date();
      if (lastSync && (now.getTime() - lastSync.getTime()) > 60000) {
        console.log('⚠️ [HEARTBEAT] Sem atualizações há mais de 1 min, fazendo fetch manual');
        setIsConnected(false);
        fetchAuctionData();
      }
    }, 30000);

    // Polling de backup a cada 30 segundos
    const pollingInterval = setInterval(() => {
      if (!isConnected) {
        console.log('🔄 [POLLING] Fazendo backup sync (realtime desconectado)');
        fetchAuctionData();
      }
    }, 30000);

    // Cleanup
    return () => {
      isSubscribed = false;
      console.log('🔌 Desconectando realtime channels');
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      clearInterval(pollingInterval);
      
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      
      setIsConnected(false);
    };
  }, [auctionId, fetchAuctionData, lastSync]);

  // Função para forçar sincronização
  const forceSync = useCallback(() => {
    console.log('🔄 [FORCE] Sincronização forçada pelo usuário');
    fetchAuctionData();
  }, [fetchAuctionData]);

  return {
    auctionData,
    recentBids,
    isConnected,
    lastSync,
    forceSync
  };
};