import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AuctionData {
  id: string;
  title: string;
  current_price: number;
  time_left: number;
  total_bids: number;
  status: string;
  winner_name?: string;
  ends_at?: string;
  image_url?: string;
  description?: string;
}

export const useAuctionRealtime = () => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const syncAuctions = useCallback(async () => {
    try {
      console.log('🔄 [SYNC] Fazendo sincronização');
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [SYNC] Erro na sincronização:', error);
        throw error;
      }

      if (data) {
        setAuctions(data);
        setLastSync(new Date());
        console.log(`✅ [SYNC] Sincronização OK: ${data.length} leilões`);
      }
    } catch (error) {
      console.error('❌ [SYNC] Sincronização falhou:', error);
      toast({
        title: "Erro de conexão",
        description: "Problemas para sincronizar dados dos leilões",
        variant: "destructive",
      });
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
            (payload) => {
              const auction_id = (payload.new as any)?.id || (payload.old as any)?.id;
              const time_left = (payload.new as any)?.time_left;
              const status = (payload.new as any)?.status;
              
              console.log('🔄 [REALTIME] Update recebido:', {
                auction_id,
                time_left,
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
                  return current.map(auction => 
                    auction.id === auction_id 
                      ? { ...auction, ...payload.new }
                      : auction
                  );
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

        // Polling de backup menos frequente (backend gerencia a lógica principal)
        pollInterval = setInterval(syncAuctions, 60000); // 1 minuto

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