import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuctionDetail {
  id: string;
  current_price: number;
  total_bids: number;
  status: string;
  winner_id?: string;
  winner_name?: string;
}

export const useAuctionDetail = (auctionId?: string) => {
  const [auctionData, setAuctionData] = useState<AuctionDetail | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

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
        console.log(`🎯 [${auctionId}] Status: ${data.status} | Source: POLLING`);
        setAuctionData(data);
        setLastSync(new Date());
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
          console.log(`🎯 [${auctionId}] Status: ${newData.status} | Source: REALTIME`);
          
          setAuctionData(newData);
          setLastSync(new Date());
        }
      )
      .subscribe((status) => {
        console.log(`🔌 [${auctionId}] Realtime status:`, status);
        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`⚠️ [${auctionId}] Conexão realtime perdida. Status: ${status}`);
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ [${auctionId}] Reconectado ao realtime com sucesso`);
        }
      });

    // Polling de backup
    const intervalRef = setInterval(() => {
      if (!isConnected) {
        console.log(`📊 [${auctionId}] Polling de emergência (realtime desconectado)`);
        fetchAuctionData();
      }
    }, 5000);

    return () => {
      clearInterval(intervalRef);
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [auctionId, fetchAuctionData]);

  const forceSync = useCallback(() => {
    console.log(`🔄 [${auctionId}] Sincronização forçada`);
    fetchAuctionData();
  }, [fetchAuctionData, auctionId]);

  return {
    auctionData,
    isConnected,
    lastSync,
    forceSync
  };
};