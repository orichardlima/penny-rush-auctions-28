import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AuctionData {
  id: string;
  title: string;
  current_price: number;
  total_bids: number;
  status: string;
  winner_name?: string;
  image_url?: string;
  description?: string;
  updated_at?: string;
}

export const useAuctionRealtime = () => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const syncAuctions = useCallback(async () => {
    try {
      console.log('🔄 [REALTIME] Sincronizando leilões...');
      
      const { data: auctionsData, error } = await supabase
        .from('auctions')
        .select('*')
        .in('status', ['active', 'waiting', 'finished'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [REALTIME] Erro ao buscar leilões:', error);
        toast({
          title: "Erro de conexão",
          description: "Falha ao sincronizar leilões. Tentando novamente...",
          variant: "destructive",
        });
        return;
      }

      if (auctionsData) {
        setAuctions(auctionsData);
        setLastSync(new Date());
        console.log(`✅ [REALTIME] ${auctionsData.length} leilões sincronizados`);
      }
    } catch (error) {
      console.error('❌ [REALTIME] Erro na sincronização:', error);
    }
  }, [toast]);

  useEffect(() => {
    let channel: any = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const initializeRealtime = async () => {
      try {
        // Carregar dados iniciais
        await syncAuctions();

        // Configurar realtime
        channel = supabase
          .channel('auction-updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'auctions'
            },
            async (payload) => {
              const auction_id = (payload.new as any)?.id || (payload.old as any)?.id;
              const status = (payload.new as any)?.status;
              
              console.log('🔄 [REALTIME] Update recebido:', {
                auction_id,
                status,
                event: payload.eventType,
                timestamp: new Date().toISOString()
              });
              
              setAuctions(current => {
                if (payload.eventType === 'DELETE') {
                  return current.filter(a => a.id !== (payload.old as any).id);
                }
                
                if (payload.eventType === 'INSERT') {
                  return [payload.new as AuctionData, ...current];
                }
                
                if (payload.eventType === 'UPDATE') {
                  const updatedAuction = payload.new as AuctionData;
                  
                  return current.map(auction => {
                    if (auction.id === auction_id) {
                      return { ...auction, ...updatedAuction };
                    }
                    return auction;
                  });
                }
                
                return current;
              });
              
              setLastSync(new Date());
            }
          )
          .subscribe((status) => {
            console.log('🔌 [REALTIME] Status da conexão:', status);
            setIsConnected(status === 'SUBSCRIBED');
            
            if (status === 'CLOSED') {
              toast({
                title: "Conexão perdida",
                description: "Tentando reconectar automaticamente...",
                variant: "destructive",
              });
            }
          });

        // Polling de backup bem menos frequente 
        pollInterval = setInterval(syncAuctions, 300000); // 5 minutos

      } catch (error) {
        console.error('❌ [REALTIME] Erro na inicialização:', error);
        toast({
          title: "Erro de inicialização", 
          description: "Falha ao conectar com o sistema de leilões",
          variant: "destructive",
        });
      }
    };

    initializeRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [syncAuctions, toast]);

  return {
    auctions,
    isConnected,
    lastSync,
    forceSync: syncAuctions
  };
};