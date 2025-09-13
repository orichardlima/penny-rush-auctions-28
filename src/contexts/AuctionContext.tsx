import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toZonedTime } from 'date-fns-tz';

interface AuctionContextType {
  auctions: any[];
  setAuctions: React.Dispatch<React.SetStateAction<any[]>>;
  isConnected: boolean;
  lastSync: Date | null;
  forceSync: () => Promise<void>;
  refreshAuction: (auctionId: string) => Promise<void>;
}

const AuctionContext = createContext<AuctionContextType | undefined>(undefined);

export const useAuctionContext = () => {
  const context = useContext(AuctionContext);
  if (!context) {
    throw new Error('useAuctionContext must be used within AuctionProvider');
  }
  return context;
};

interface AuctionProviderProps {
  children: React.ReactNode;
}

export const AuctionProvider = ({ children }: AuctionProviderProps) => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();
  const channelRef = useRef<any>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastVisibilityChange = useRef<number>(Date.now());

  // Fetch winner profile
  const fetchWinnerProfile = async (winnerId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, city, state')
        .eq('user_id', winnerId)
        .single();
      
      if (profile && profile.full_name) {
        const region = profile.city && profile.state 
          ? `${profile.city}, ${profile.state}`
          : '';
        return region 
          ? `${profile.full_name} - ${region}`
          : profile.full_name;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar perfil do ganhador:', error);
      return null;
    }
  };

  // Fetch recent bidders
  const fetchRecentBidders = async (auctionId: string) => {
    try {
      const { data: bids } = await supabase
        .from('bids')
        .select(`
          user_id,
          profiles!inner(full_name, is_bot)
        `)
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!bids) return [];

      const bidders = await Promise.all(
        bids.map(async (bid: any) => {
          if (bid.profiles.is_bot) {
            return 'Sistema';
          }
          return bid.profiles.full_name || `Usuário ${bid.user_id.slice(0, 8)}`;
        })
      );

      return bidders;
    } catch (error) {
      console.error('Erro ao buscar lances recentes:', error);
      return [];
    }
  };

  // Transform auction data
  const transformAuctionData = async (auction: any) => {
    const timeZone = 'America/Sao_Paulo';
    const now = toZonedTime(new Date(), timeZone);
    const startsAt = auction.starts_at ? toZonedTime(new Date(auction.starts_at), timeZone) : now;
    
    let auctionStatus = auction.status;
    let timeLeft = auction.time_left || 15;

    if (auction.status === 'waiting' && startsAt <= now) {
      auctionStatus = 'active';
    }

    const transformed = {
      ...auction,
      auctionStatus,
      timeLeft,
      isActive: auctionStatus === 'active',
      recentBidders: auction.recentBidders || []
    };

    if (auction.winner_id && !auction.winner_name) {
      const winnerProfile = await fetchWinnerProfile(auction.winner_id);
      transformed.winner_name = winnerProfile;
    }

    return transformed;
  };

  // Main sync function
  const forceSync = useCallback(async () => {
    try {
      console.log('🔄 [CONTEXT] Forcing full synchronization...');
      setLastSync(new Date());
      
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const transformedAuctions = await Promise.all(
          data.map(async (auction) => {
            const recentBidders = await fetchRecentBidders(auction.id);
            return transformAuctionData({
              ...auction,
              recentBidders
            });
          })
        );
        
        setAuctions(transformedAuctions);
        console.log('✅ [CONTEXT] Sync completed, auctions updated');
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Sync error:', error);
      setIsConnected(false);
    }
  }, []);

  // Refresh single auction
  const refreshAuction = useCallback(async (auctionId: string) => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', auctionId)
        .single();

      if (error) throw error;

      if (data) {
        const recentBidders = await fetchRecentBidders(auctionId);
        const transformedAuction = await transformAuctionData({
          ...data,
          recentBidders
        });

        setAuctions(prev => 
          prev.map(auction => 
            auction.id === auctionId ? transformedAuction : auction
          )
        );
      }
    } catch (error) {
      console.error('❌ [CONTEXT] Error refreshing auction:', error);
    }
  }, []);

  // Setup realtime connection
  const setupRealtime = useCallback(() => {
    console.log('📡 [CONTEXT] Setting up realtime connection...');
    
    // Clear existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('global-auctions-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'auctions' },
        async (payload) => {
          console.log('🔄 [CONTEXT] Auction updated:', payload.new.id);
          await refreshAuction(payload.new.id);
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'auctions' },
        async (payload) => {
          console.log('✨ [CONTEXT] New auction:', payload.new.id);
          await forceSync(); // Full sync for new auctions
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids' },
        async (payload) => {
          console.log('🎯 [CONTEXT] New bid:', payload.new.auction_id);
          await refreshAuction(payload.new.auction_id);
        }
      )
      .subscribe((status) => {
        console.log('📡 [CONTEXT] Realtime status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          setLastSync(new Date());
          console.log('✅ [CONTEXT] Realtime connected successfully');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ [CONTEXT] Realtime connection lost');
          setIsConnected(false);
        }
      });

    // Fallback polling when disconnected
    const pollInterval = setInterval(() => {
      if (!isConnected) {
        console.log('📊 [CONTEXT] Emergency polling (realtime disconnected)');
        forceSync();
      }
    }, 3000); // 3 seconds for faster recovery

    return () => {
      clearInterval(pollInterval);
    };
  }, [isConnected, forceSync, refreshAuction]);

  // Page Visibility API - detect when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastChange = now - lastVisibilityChange.current;
      
      if (!document.hidden) {
        console.log('👀 [CONTEXT] User returned to page');
        
        // If user was away for more than 30 seconds, force full sync
        if (timeSinceLastChange > 30000) {
          console.log('🔄 [CONTEXT] User was away for long time, forcing sync...');
          
          // Clear existing sync timeout
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
          }
          
          // Delay sync slightly to allow components to stabilize
          syncTimeoutRef.current = setTimeout(() => {
            forceSync();
            setupRealtime(); // Reconnect realtime
          }, 1000);
        }
      }
      
      lastVisibilityChange.current = now;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [forceSync, setupRealtime]);

  // Initialize
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      await forceSync();
      cleanup = setupRealtime();
    };

    initialize();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (cleanup) {
        cleanup();
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AuctionContext.Provider 
      value={{
        auctions,
        setAuctions,
        isConnected,
        lastSync,
        forceSync,
        refreshAuction
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
};