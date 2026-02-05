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
  last_bid_at: string | null;
}

interface AuctionRealtimeContextType {
  auctions: AuctionData[];
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
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // Força re-render a cada segundo
  const { toast } = useToast();
  
  const resyncIntervalRef = useRef<NodeJS.Timeout>();
  const emergencyPollRef = useRef<NodeJS.Timeout>();
  const disconnectToastTimeoutRef = useRef<NodeJS.Timeout>();

  // Calcular tempo restante a partir de timestamp absoluto
  const calculateTimeLeft = useCallback((auction: AuctionData): number => {
    if (auction.auctionStatus !== 'active') return 0;
    
    const lastBidAt = auction.last_bid_at 
      ? new Date(auction.last_bid_at).getTime() 
      : Date.now();
    
    const deadline = lastBidAt + (15 * 1000); // 15 segundos após último lance
    const now = Date.now();
    const remaining = Math.ceil((deadline - now) / 1000);
    
    return Math.max(0, remaining);
  }, []);

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
      created_at: auction.created_at,
      last_bid_at: auction.last_bid_at
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

    console.log(`🎯 [${auctionId}] Atualizado via Realtime | last_bid_at: ${updatedAuction.last_bid_at}`);
  }, []);

  // Adicionar novo leilão
  const addAuction = useCallback(async (newData: any) => {
    const recentBidders = await fetchRecentBidders(newData.id);
    const newAuction = await transformAuctionData({ ...newData, recentBidders });
    
    if (newAuction.auctionStatus === 'active' || newAuction.auctionStatus === 'waiting') {
      setAuctions(prev => [newAuction, ...prev]);
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

  // Tick a cada segundo para forçar re-render e atualizar timers calculados
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Sync automático quando timer está crítico (< 3s)
  useEffect(() => {
    const checkCriticalTimers = () => {
      const hasLowTimer = auctions.some(auction => {
        const timeLeft = calculateTimeLeft(auction);
        return timeLeft > 0 && timeLeft <= 3;
      });
      
      if (hasLowTimer) {
        console.log('⚠️ [REALTIME-CONTEXT] Timer crítico detectado, forçando sync');
        fetchAuctions();
      }
    };
    
    const interval = setInterval(checkCriticalTimers, 3000);
    return () => clearInterval(interval);
  }, [auctions, calculateTimeLeft, fetchAuctions]);

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
          console.log(`📡 [REALTIME] UPDATE recebido: ${payload.new.id} | last_bid_at: ${(payload.new as any).last_bid_at}`);
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
                variant: "default",
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

  // Função para obter timer de um leilão específico (calculado dinamicamente)
  const getAuctionTimer = useCallback((auctionId: string) => {
    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) return 0;
    return calculateTimeLeft(auction);
  }, [auctions, calculateTimeLeft, tick]); // tick força recálculo a cada segundo

  const value = {
    auctions,
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
