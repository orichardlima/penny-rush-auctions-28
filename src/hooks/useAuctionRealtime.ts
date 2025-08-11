import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuctionUpdate {
  id: string;
  current_price: number;
  total_bids: number;
  time_left: number;
  ends_at: string;
  status: string;
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
  const { toast } = useToast();

  useEffect(() => {
    if (!auctionId) return;

    console.log('🔄 Configurando realtime para leilão:', auctionId);

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
          console.log('📡 [REALTIME] Update do leilão recebido:', payload);
          const newAuctionData = payload.new as AuctionUpdate;
          setAuctionData(newAuctionData);
          
          // Log detalhado para debug
          console.log('🕐 [REALTIME] Timer atualizado via banco:', {
            auction_id: newAuctionData.id,
            time_left: newAuctionData.time_left,
            current_price: newAuctionData.current_price,
            total_bids: newAuctionData.total_bids,
            ends_at: newAuctionData.ends_at,
            status: newAuctionData.status,
            timestamp: new Date().toISOString()
          });
        }
      )
      .subscribe();

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
          console.log('🎯 Novo lance recebido:', payload);
          const newBid = payload.new as BidUpdate;
          
          setRecentBids(prev => [newBid, ...prev.slice(0, 9)]); // Manter apenas 10 lances
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      console.log('🔌 Desconectando realtime channels');
      supabase.removeChannel(auctionChannel);
      supabase.removeChannel(bidsChannel);
    };
  }, [auctionId, toast]);

  // Função para resetar timer (simulação - na implementação real viria do realtime)
  const resetTimer = () => {
    if (auctionData) {
      setAuctionData(prev => prev ? { ...prev, time_left: 15 } : null);
    }
  };

  return {
    auctionData,
    recentBids,
    resetTimer
  };
};