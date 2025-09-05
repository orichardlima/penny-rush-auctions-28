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
  updated_at?: string;
}

export const useAuctionRealtime = () => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const updateAuction = useCallback((id: string, updates: any) => {
    setAuctions(current => 
      current.map(auction => 
        auction.id === id ? { ...auction, ...updates } : auction
      )
    );
  }, []);

  const syncAuctions = useCallback(async () => {
    try {
      setLastSync(new Date());
      
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setAuctions(data);
      }
    } catch (error) {
      console.error('Error syncing auctions:', error);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    let channel: any = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const initializeRealtime = async () => {
      try {
        await syncAuctions();

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
              console.log(`🎯 [${(payload.new as any)?.id}] Timer: ${(payload.new as any)?.time_left}s | Status: ${(payload.new as any)?.status} | Source: REALTIME`);
              
              if (payload.eventType === 'UPDATE') {
                updateAuction((payload.new as any).id, payload.new);
              } else if (payload.eventType === 'INSERT') {
                setAuctions(current => [payload.new as AuctionData, ...current]);
              } else if (payload.eventType === 'DELETE') {
                setAuctions(current => current.filter(a => a.id !== (payload.old as any).id));
              }
              
              setLastSync(new Date());
            }
          )
          .subscribe((status) => {
            console.log('🔌 [REALTIME] Status:', status);
            setIsConnected(status === 'SUBSCRIBED');
            
            if (status === 'CLOSED') {
              toast({
                title: "Conexão perdida",
                description: "Tentando reconectar...",
                variant: "destructive",
              });
            }
          });

        // Fallback polling when disconnected
        pollInterval = setInterval(() => {
          if (!isConnected) {
            console.log('📊 Polling de emergência (realtime desconectado)');
            syncAuctions();
          }
        }, 30000);

      } catch (error) {
        console.error('❌ [REALTIME] Erro:', error);
        setIsConnected(false);
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
  }, [syncAuctions, toast, isConnected]);

  return {
    auctions,
    isConnected,
    lastSync,
    forceSync: syncAuctions
  };
};