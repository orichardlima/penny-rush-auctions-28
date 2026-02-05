import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toZonedTime } from 'date-fns-tz';
import { formatUserNameForDisplay } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Tipos
export interface AuctionData {
  id: string;
  title: string;
  description: string;
  image: string;
  currentPrice: number;
  originalPrice: number;
  totalBids: number;
  participants: number;
  recentBidders: string[];
  currentRevenue: number;
  timeLeft: number;
  auctionStatus: 'waiting' | 'active' | 'finished';
  isActive: boolean;
  ends_at: string | null;
  starts_at: string | null;
  finished_at: string | null;
  winnerId: string | null;
  winnerName: string | null;
  status: string;
  created_at: string;
}

interface AuctionRealtimeContextType {
  auctions: AuctionData[];
  timers: Map<string, number>;
  isConnected: boolean;
  loading: boolean;
  getAuctionTimer: (auctionId: string) => number;
  forceSync: () => Promise<void>;
}

const AuctionRealtimeContext = createContext<AuctionRealtimeContextType | undefined>(undefined);

export const useAuctionRealtime = () => {
  const context = useContext(AuctionRealtimeContext);
  if (!context) {
    throw new Error('useAuctionRealtime must be used within an AuctionRealtimeProvider');
  }
  return context;
};

interface AuctionRealtimeProviderProps {
  children: React.ReactNode;
}

export const AuctionRealtimeProvider: React.FC<AuctionRealtimeProviderProps> = ({ children }) => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [timers, setTimers] = useState<Map<string, number>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const timerIntervalRef = useRef<NodeJS.Timeout>();
  const resyncIntervalRef = useRef<NodeJS.Timeout>();
  const emergencyPollRef = useRef<NodeJS.Timeout>();
  const disconnectToastTimeoutRef = useRef<NodeJS.Timeout>();

  // Buscar perfil do ganhador
  const fetchWinnerProfile = async (winnerId: string): Promise<string | null> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, city, state')
        .eq('user_id', winnerId)
        .single();
      
      if (profile?.full_name) {
        const region = profile.city && profile.state 
          ? `${profile.city}, ${profile.state}` 
          : '';
        return region 
          ? `${formatUserNameForDisplay(profile.full_name)} - ${region}`
          : formatUserNameForDisplay(profile.full_name);
      }
      return null;
    } catch {
      return null;
    }
  };

  // Buscar últimos lances
  const fetchRecentBidders = async (auctionId: string): Promise<string[]> => {
    try {
      const { data: bids, error } = await supabase
        .from('bids')
        .select('user_id, created_at')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !bids?.length) return [];

      const userIds = bids.map(bid => bid.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const userNameMap = new Map<string, string>();
      profiles?.forEach(profile => {
        userNameMap.set(profile.user_id, formatUserNameForDisplay(profile.full_name || ''));
      });

      return bids.map(bid => userNameMap.get(bid.user_id) || 'Usuário');
    } catch {
      return [];
    }
  };

  // Transformar dados do leilão
  const transformAuctionData = async (auction: any): Promise<AuctionData> => {
    const brazilTimezone = 'America/Sao_Paulo';
    const now = new Date();
    const nowInBrazil = toZonedTime(now, brazilTimezone);
    
    const startsAt = auction.starts_at 
      ? toZonedTime(new Date(auction.starts_at), brazilTimezone) 
      : null;
    const endsAt = auction.ends_at 
      ? toZonedTime(new Date(auction.ends_at), brazilTimezone) 
      : null;
    
    let auctionStatus: 'waiting' | 'active' | 'finished' = 'waiting';
    if (startsAt && startsAt > nowInBrazil) {
      auctionStatus = 'waiting';
    } else if (auction.status === 'active' && (!endsAt || endsAt > nowInBrazil)) {
      auctionStatus = 'active';
    } else {
      auctionStatus = 'finished';
    }

    let winnerNameWithRegion = auction.winner_name;
    if (auctionStatus === 'finished' && auction.winner_id) {
      const fullWinnerName = await fetchWinnerProfile(auction.winner_id);
      if (fullWinnerName) {
        winnerNameWithRegion = fullWinnerName;
      }
    }
    
    return {
      id: auction.id,
      title: auction.title,
      description: auction.description,
      image: auction.image_url || '/placeholder.svg',
      currentPrice: auction.current_price || 1.00,
      originalPrice: auction.market_value || 0,
      totalBids: auction.total_bids || 0,
      participants: auction.participants_count || 0,
      recentBidders: auction.recentBidders || [],
      currentRevenue: (auction.total_bids || 0) * 1.00,
      timeLeft: auction.time_left || 15,
      auctionStatus,
      isActive: auctionStatus === 'active',
      ends_at: auction.ends_at,
      starts_at: auction.starts_at,
      finished_at: auction.finished_at,
      winnerId: auction.winner_id,
      winnerName: winnerNameWithRegion,
      status: auction.status,
      created_at: auction.created_at
    };
  };

  // Buscar todos os leilões
  const fetchAuctions = useCallback(async () => {
    try {
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'finished_auctions_display_hours')
        .single();

      const displayHours = parseInt(settingsData?.setting_value || '48');
      
      let query = supabase.from('auctions').select('*');
      
      if (displayHours > 0) {
        const cutoffTime = new Date(Date.now() - displayHours * 60 * 60 * 1000).toISOString();
        query = query.or(`status.in.(active,waiting),and(status.eq.finished,updated_at.gte.${cutoffTime},is_hidden.eq.false)`);
      } else {
        query = query.in('status', ['active', 'waiting']);
      }
      
      const { data, error } = await query.order('starts_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('❌ [REALTIME-CONTEXT] Erro ao buscar leilões:', error);
        return;
      }

      // Processar em paralelo
      const auctionsWithBidders = await Promise.all(
        (data || []).map(async (auction, index) => {
          const recentBidders = await fetchRecentBidders(auction.id);
          const transformed = await transformAuctionData({ ...auction, recentBidders });
          return { ...transformed, _originalIndex: index };
        })
      );

      // Ordenar pela ordem original e limpar campo auxiliar
      auctionsWithBidders.sort((a, b) => a._originalIndex - b._originalIndex);
      const cleanAuctions = auctionsWithBidders.map(({ _originalIndex, ...auction }) => auction) as AuctionData[];
      
      setAuctions(cleanAuctions);

      // Inicializar timers com time_left de cada leilão
      const newTimers = new Map<string, number>();
      cleanAuctions.forEach(auction => {
        if (auction.auctionStatus === 'active') {
          newTimers.set(auction.id, auction.timeLeft);
        }
      });
      setTimers(newTimers);

      console.log(`✅ [REALTIME-CONTEXT] ${cleanAuctions.length} leilões carregados`);
    } catch (error) {
      console.error('❌ [REALTIME-CONTEXT] Erro:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualizar um leilão específico
  const updateAuction = useCallback(async (auctionId: string, newData: any) => {
    const recentBidders = await fetchRecentBidders(auctionId);
    const updatedAuction = await transformAuctionData({ ...newData, recentBidders });
    
    setAuctions(prev => 
      prev.map(auction => auction.id === updatedAuction.id ? updatedAuction : auction)
    );

    // Se recebeu novo lance, resetar timer para 15 segundos
    if (updatedAuction.auctionStatus === 'active') {
      setTimers(prev => {
        const newTimers = new Map(prev);
        newTimers.set(auctionId, 15);
        return newTimers;
      });
      console.log(`🎯 [${auctionId}] Timer resetado para 15s via Realtime`);
    }

    // Se finalizou, remover do timer
    if (updatedAuction.auctionStatus === 'finished') {
      setTimers(prev => {
        const newTimers = new Map(prev);
        newTimers.delete(auctionId);
        return newTimers;
      });
      console.log(`🏁 [${auctionId}] Leilão finalizado`);
    }
  }, []);

  // Adicionar novo leilão
  const addAuction = useCallback(async (newData: any) => {
    const recentBidders = await fetchRecentBidders(newData.id);
    const newAuction = await transformAuctionData({ ...newData, recentBidders });
    
    if (newAuction.auctionStatus === 'active' || newAuction.auctionStatus === 'waiting') {
      setAuctions(prev => [newAuction, ...prev]);
      
      if (newAuction.auctionStatus === 'active') {
        setTimers(prev => {
          const newTimers = new Map(prev);
          newTimers.set(newAuction.id, newAuction.timeLeft);
          return newTimers;
        });
      }
    }
    
    return newAuction;
  }, []);

  // Atualizar bidders quando novo lance é inserido
  const updateRecentBidders = useCallback(async (auctionId: string) => {
    const recentBidders = await fetchRecentBidders(auctionId);
    setAuctions(prev => 
      prev.map(auction => 
        auction.id === auctionId ? { ...auction, recentBidders } : auction
      )
    );
  }, []);

  // Timer local que decrementa a cada segundo
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setTimers(prev => {
        const newTimers = new Map(prev);
        let hasChanges = false;
        
        newTimers.forEach((time, auctionId) => {
          if (time > 0) {
            newTimers.set(auctionId, time - 1);
            hasChanges = true;
          }
        });
        
        return hasChanges ? newTimers : prev;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Resync periódico a cada 60 segundos
  useEffect(() => {
    resyncIntervalRef.current = setInterval(() => {
      console.log('🔄 [REALTIME-CONTEXT] Resync periódico (60s)');
      fetchAuctions();
    }, 60000);

    return () => {
      if (resyncIntervalRef.current) {
        clearInterval(resyncIntervalRef.current);
      }
    };
  }, [fetchAuctions]);

  // Detectar quando usuário volta à aba
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👀 [REALTIME-CONTEXT] Usuário voltou à aba, forçando sync');
        fetchAuctions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAuctions]);

  // Setup do canal Realtime único
  useEffect(() => {
    fetchAuctions();

    const channel = supabase
      .channel('global-auctions-channel')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'auctions' },
        async (payload) => {
          console.log(`📡 [REALTIME] UPDATE recebido: ${payload.new.id}`);
          await updateAuction(payload.new.id, payload.new);
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'auctions' },
        async (payload) => {
          console.log(`📡 [REALTIME] INSERT recebido: ${payload.new.id}`);
          const newAuction = await addAuction(payload.new);
          if (newAuction.auctionStatus === 'active' || newAuction.auctionStatus === 'waiting') {
            toast({
              title: "Novo leilão disponível!",
              description: `${newAuction.title} foi adicionado aos leilões ativos.`,
            });
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids' },
        async (payload) => {
          console.log(`📡 [REALTIME] Novo lance: ${payload.new.auction_id}`);
          await updateRecentBidders(payload.new.auction_id);
          
          // Resetar timer para 15 segundos quando novo lance
          setTimers(prev => {
            const newTimers = new Map(prev);
            if (newTimers.has(payload.new.auction_id)) {
              newTimers.set(payload.new.auction_id, 15);
            }
            return newTimers;
          });
        }
      )
      .subscribe((status) => {
        console.log('🔌 [REALTIME-CONTEXT] Status:', status);
        setIsConnected(status === 'SUBSCRIBED');

        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Aguardar 5 segundos antes de mostrar toast (reconexões rápidas são silenciosas)
          if (!disconnectToastTimeoutRef.current) {
            disconnectToastTimeoutRef.current = setTimeout(() => {
              toast({
                title: "Conexão instável",
                description: "Reconectando automaticamente...",
                variant: "default", // Menos alarmante que "destructive"
              });
              disconnectToastTimeoutRef.current = undefined;
            }, 5000);
          }

          // Ativar polling de emergência
          if (!emergencyPollRef.current) {
            emergencyPollRef.current = setInterval(() => {
              console.log('🆘 [REALTIME-CONTEXT] Polling de emergência');
              fetchAuctions();
            }, 5000);
          }
        } else if (status === 'SUBSCRIBED') {
          // Cancelar toast pendente se reconectou rapidamente
          if (disconnectToastTimeoutRef.current) {
            clearTimeout(disconnectToastTimeoutRef.current);
            disconnectToastTimeoutRef.current = undefined;
            console.log('✅ [REALTIME-CONTEXT] Reconexão silenciosa bem-sucedida');
          }
          
          // Desativar polling de emergência quando reconectar
          if (emergencyPollRef.current) {
            clearInterval(emergencyPollRef.current);
            emergencyPollRef.current = undefined;
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (emergencyPollRef.current) {
        clearInterval(emergencyPollRef.current);
      }
      if (disconnectToastTimeoutRef.current) {
        clearTimeout(disconnectToastTimeoutRef.current);
      }
    };
  }, [fetchAuctions, updateAuction, addAuction, updateRecentBidders, toast]);

  // Função para obter timer de um leilão específico
  const getAuctionTimer = useCallback((auctionId: string) => {
    return timers.get(auctionId) ?? 0;
  }, [timers]);

  const value = {
    auctions,
    timers,
    isConnected,
    loading,
    getAuctionTimer,
    forceSync: fetchAuctions
  };

  return (
    <AuctionRealtimeContext.Provider value={value}>
      {children}
    </AuctionRealtimeContext.Provider>
  );
};
