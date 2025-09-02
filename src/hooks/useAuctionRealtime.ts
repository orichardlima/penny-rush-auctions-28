import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLocalTimers } from '@/hooks/useLocalTimers';

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
  local_timer?: boolean; // Flag para indicar timer calculado localmente
}

export const useAuctionRealtime = () => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  // 🎯 OPÇÃO A: Função para atualizar leilão específico
  const updateAuction = useCallback((id: string, updates: any) => {
    setAuctions(current => 
      current.map(auction => 
        auction.id === id ? { ...auction, ...updates } : auction
      )
    );
  }, []);

  // 🎯 OPÇÃO A: Hook para timers locais em tempo real
  useLocalTimers(auctions, updateAuction);

  // 🎯 OPÇÃO A: Calcular timer local para sincronização inicial
  const calculateInitialTimer = useCallback((auction: any, lastBidTime?: string) => {
    if (auction.status !== 'active') return auction.time_left || 0;
    
    const now = new Date();
    const lastActivity = lastBidTime ? new Date(lastBidTime) : new Date(auction.updated_at);
    const secondsSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / 1000);
    const localTimer = Math.max(0, 15 - secondsSinceActivity);
    
    console.log(`🎯 [${auction.id}] Timer inicial: ${localTimer}s (${secondsSinceActivity}s desde atividade)`);
    return localTimer;
  }, []);

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
        // 🎯 OPÇÃO A: Buscar último bid para cada leilão ativo para calcular timer local
        const auctionsWithLocalTimers = await Promise.all(
          auctionsData.map(async (auction) => {
            if (auction.status === 'active') {
              const { data: lastBid } = await supabase
                .from('bids')
                .select('created_at')
                .eq('auction_id', auction.id)
                .order('created_at', { ascending: false })
                .limit(1);
              
              const lastBidTime = lastBid?.[0]?.created_at;
              const localTimer = calculateInitialTimer(auction, lastBidTime);
              
              return {
                ...auction,
                time_left: localTimer,
                local_timer: true // Flag para indicar timer calculado localmente
              };
            }
            return auction;
          })
        );

        setAuctions(auctionsWithLocalTimers);
        setLastSync(new Date());
        console.log(`✅ [REALTIME] ${auctionsData.length} leilões sincronizados com timers locais`);
      }
    } catch (error) {
      console.error('❌ [REALTIME] Erro na sincronização:', error);
    }
  }, [calculateInitialTimer, toast]);

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
                  const updatedAuction = payload.new as AuctionData;
                  
                  return current.map(auction => {
                    if (auction.id === auction_id) {
                      // 🎯 OPÇÃO A: Se for leilão ativo, manter timer local (não usar do backend)
                      if (updatedAuction.status === 'active') {
                        return {
                          ...auction,
                          ...updatedAuction,
                          // Manter timer local existente se houver
                          time_left: auction.local_timer ? auction.time_left : updatedAuction.time_left,
                          local_timer: auction.local_timer || false
                        };
                      }
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