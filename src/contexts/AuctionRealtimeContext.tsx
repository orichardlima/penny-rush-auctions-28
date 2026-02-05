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

export interface AuctionTimerResult {
  timeLeft: number;
  isSyncing: boolean;
}

interface AuctionRealtimeContextType {
  auctions: AuctionData[];
  isConnected: boolean;
  loading: boolean;
  getAuctionTimer: (auctionId: string) => AuctionTimerResult;
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

// Helper puro para cálculo de timer baseado em timestamps absolutos
const calculateTimeLeftFromFields = (
  status: string,
  lastBidAt: string | null,
  endsAt: string | null
): number => {
  if (status !== 'active') return 0;
  if (!lastBidAt) return -1; // Precisa sync
  
  const lastBidTime = new Date(lastBidAt).getTime();
  const bidDeadline = lastBidTime + (15 * 1000); // 15 segundos após último lance
  
  let deadline = bidDeadline;
  if (endsAt) {
    deadline = Math.min(bidDeadline, new Date(endsAt).getTime());
  }
  
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
};

export const AuctionRealtimeProvider: React.FC<AuctionRealtimeProviderProps> = ({ children }) => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // Força re-render a cada segundo
  const { toast } = useToast();
  
  const resyncIntervalRef = useRef<NodeJS.Timeout>();
  const emergencyPollRef = useRef<NodeJS.Timeout>();
  const lastCriticalSyncRef = useRef<Map<string, number>>(new Map());

  // Calcular tempo restante a partir de timestamp absoluto (usando helper)
  const calculateTimeLeft = useCallback((auction: AuctionData): number => {
    return calculateTimeLeftFromFields(
      auction.auctionStatus === 'active' ? 'active' : auction.status,
      auction.last_bid_at,
      auction.ends_at
    );
  }, []);

  // Buscar um leilão específico com throttle
  const fetchSingleAuction = useCallback(async (auctionId: string, throttleMs: number = 2000) => {
    const lastSync = lastCriticalSyncRef.current.get(auctionId) || 0;
    const now = Date.now();
    
    if (now - lastSync < throttleMs) {
      console.log(`⏳ [${auctionId}] Throttled (${throttleMs}ms)`);
      return;
    }
    
    lastCriticalSyncRef.current.set(auctionId, now);
    
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();
      
      if (error || !data) {
        console.error(`❌ [${auctionId}] Erro ao buscar:`, error);
        return;
      }
      
      const recentBidders = await fetchRecentBidders(auctionId);
      const updatedAuction = await transformAuctionData({ ...data, recentBidders });
      
      setAuctions(prev => 
        prev.map(auction => auction.id === auctionId ? updatedAuction : auction)
      );
      
      console.log(`🔄 [${auctionId}] Sync individual | last_bid_at: ${updatedAuction.last_bid_at}`);
    } catch (error) {
      console.error(`❌ [${auctionId}] Erro no fetch:`, error);
    }
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

  // Atualizar um leilão específico (usa payload.new diretamente para evitar race condition)
  const updateAuction = useCallback(async (auctionId: string, newData: any) => {
    // Calcular timeLeft diretamente do payload para evitar state stale
    const calculatedTimeLeft = calculateTimeLeftFromFields(
      newData.status,
      newData.last_bid_at,
      newData.ends_at
    );
    
    console.log(`🎯 [${auctionId}] UPDATE | last_bid_at: ${newData.last_bid_at} | timeLeft calc: ${calculatedTimeLeft}s`);
    
    const recentBidders = await fetchRecentBidders(auctionId);
    const updatedAuction = await transformAuctionData({ ...newData, recentBidders });
    
    setAuctions(prev => 
      prev.map(auction => auction.id === updatedAuction.id ? updatedAuction : auction)
    );
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

  // Sync automático quando timer está crítico (< 3s) - apenas leilões ativos
  useEffect(() => {
    const checkCriticalTimers = () => {
      // Filtrar apenas leilões ativos antes de iterar
      const activeAuctions = auctions.filter(a => a.auctionStatus === 'active');
      
      activeAuctions.forEach(auction => {
        const timeLeft = calculateTimeLeft(auction);
        
        // Timer crítico (1-3s): sync com throttle de 2s
        if (timeLeft > 0 && timeLeft <= 3) {
          console.log(`⚠️ [${auction.id}] Timer crítico: ${timeLeft}s`);
          fetchSingleAuction(auction.id, 2000);
        }
        
        // Precisa sync inicial (last_bid_at null): throttle de 5s
        if (timeLeft === -1) {
          console.log(`🔍 [${auction.id}] Precisa sync inicial`);
          fetchSingleAuction(auction.id, 5000);
        }
      });
    };
    
    const interval = setInterval(checkCriticalTimers, 1000);
    return () => clearInterval(interval);
  }, [auctions, calculateTimeLeft, fetchSingleAuction]);

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
          console.log('⚠️ [REALTIME] Conexão perdida, ativando polling de emergência');
          
          // Ativar polling de emergência (silencioso para usuário)
          if (!emergencyPollRef.current) {
            emergencyPollRef.current = setInterval(() => {
              console.log('🆘 [REALTIME-CONTEXT] Polling de emergência');
              fetchAuctions();
            }, 5000);
          }
        } else if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Conexão restabelecida');
          
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
    };
  }, [fetchAuctions, updateAuction, addAuction, updateRecentBidders, toast]);

  // Função para obter timer de um leilão específico (calculado dinamicamente)
  const getAuctionTimer = useCallback((auctionId: string): AuctionTimerResult => {
    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) return { timeLeft: 0, isSyncing: false };
    
    const timeLeft = calculateTimeLeft(auction);
    const isSyncing = timeLeft === -1;
    
    return { 
      timeLeft: isSyncing ? 0 : timeLeft, 
      isSyncing 
    };
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
