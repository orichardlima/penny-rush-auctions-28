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
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
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
          console.log('📡 Update do leilão recebido:', payload);
          const newAuctionData = payload.new as AuctionUpdate;
          
          // Validação: Se status=active mas time_left<=0, solicitar sincronização
          if (newAuctionData.status === 'active' && newAuctionData.time_left <= 0) {
            console.warn('⚠️ Inconsistência detectada: leilão ativo com timer zerado', {
              auction_id: auctionId,
              status: newAuctionData.status,
              time_left: newAuctionData.time_left
            });
            
            // Chamar função de sincronização em background
            supabase.functions.invoke('auction-timer-sync').catch(console.error);
          }
          
          setAuctionData(newAuctionData);
          setLastSyncTime(new Date());
          
          // Log para debug do timer
          console.log('🕐 Timer atualizado:', {
            time_left: newAuctionData.time_left,
            ends_at: newAuctionData.ends_at,
            status: newAuctionData.status
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

    // Heartbeat para detectar desconexões
    const heartbeatInterval = setInterval(() => {
      if (auctionChannel.state === 'joined') {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        console.warn('💔 Heartbeat failed - realtime disconnected');
      }
    }, 10000); // Check a cada 10 segundos

    // Cleanup
    return () => {
      console.log('🔌 Desconectando realtime channels');
      clearInterval(heartbeatInterval);
      supabase.removeChannel(auctionChannel);
      supabase.removeChannel(bidsChannel);
    };
  }, [auctionId, toast]);

  // Função para forçar sincronização manual
  const forceSync = async () => {
    if (!auctionId) return;
    
    try {
      console.log('🔄 Forçando sincronização manual...');
      const { error } = await supabase.functions.invoke('auction-timer-sync');
      
      if (error) {
        console.error('❌ Erro na sincronização:', error);
        toast({
          title: "Erro na sincronização",
          description: "Não foi possível sincronizar o timer do leilão",
          variant: "destructive"
        });
      } else {
        console.log('✅ Sincronização manual concluída');
        toast({
          title: "Sincronização realizada",
          description: "Timer do leilão sincronizado com sucesso",
        });
      }
    } catch (error) {
      console.error('❌ Erro ao chamar sincronização:', error);
    }
  };

  return {
    auctionData,
    recentBids,
    isConnected,
    lastSyncTime,
    forceSync
  };
};