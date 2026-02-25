import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FuryVaultInstance {
  id: string;
  auction_id: string;
  current_value: number;
  initial_value: number;
  max_cap: number;
  total_increments: number;
  last_increment_at_bid: number;
  fury_mode_active: boolean;
  status: string;
  top_bidder_user_id: string | null;
  top_bidder_amount: number;
  raffle_winner_user_id: string | null;
  raffle_winner_amount: number;
  distributed_at: string | null;
  qualified_count: number;
}

interface FuryVaultConfig {
  accumulation_interval: number;
  min_bids_to_qualify: number;
  is_active: boolean;
  recency_seconds: number;
}

interface FuryVaultData {
  instance: FuryVaultInstance | null;
  config: FuryVaultConfig | null;
  qualifiedCount: number;
  isQualified: boolean;
  userBidsInAuction: number;
  loading: boolean;
}

export const useFuryVault = (auctionId: string, totalBids?: number) => {
  const { user } = useAuth();
  const [data, setData] = useState<FuryVaultData>({
    instance: null,
    config: null,
    qualifiedCount: 0,
    isQualified: false,
    userBidsInAuction: 0,
    loading: true,
  });

  // Debounce ref for qualification updates
  const qualDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [instanceRes, configRes] = await Promise.all([
        supabase
          .from('fury_vault_instances')
          .select('*')
          .eq('auction_id', auctionId)
          .maybeSingle(),
        supabase
          .from('fury_vault_config')
          .select('accumulation_interval, min_bids_to_qualify, is_active, recency_seconds')
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      const instance = instanceRes.data as FuryVaultInstance | null;
      const config = configRes.data as FuryVaultConfig | null;

      let isQualified = false;
      let userBidsInAuction = 0;
      const qualifiedCount = instance?.qualified_count ?? 0;

      // Only fetch user qualification (no more count query)
      if (instance && user) {
        const userQualRes = await supabase
          .from('fury_vault_qualifications')
          .select('total_bids_in_auction, is_qualified')
          .eq('vault_instance_id', instance.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (userQualRes.data) {
          isQualified = (userQualRes.data as any).is_qualified ?? false;
          userBidsInAuction = (userQualRes.data as any).total_bids_in_auction ?? 0;
        }
      }

      setData({
        instance,
        config,
        qualifiedCount,
        isQualified,
        userBidsInAuction,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching fury vault:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [auctionId, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Unified Realtime subscription: reuse single channel for both tables
  useEffect(() => {
    const channelName = `fury-vault-${auctionId}`;
    
    let channelBuilder = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fury_vault_instances',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          if (payload.new) {
            const newInstance = payload.new as FuryVaultInstance;
            setData(prev => {
              // Dedupe: skip if values haven't changed
              if (
                prev.instance &&
                prev.instance.current_value === newInstance.current_value &&
                prev.instance.fury_mode_active === newInstance.fury_mode_active &&
                prev.instance.status === newInstance.status &&
                prev.instance.qualified_count === newInstance.qualified_count
              ) {
                return prev;
              }
              return {
                ...prev,
                instance: newInstance,
                qualifiedCount: newInstance.qualified_count ?? prev.qualifiedCount,
              };
            });
          }
        }
      );

    // Add qualification listener only if user is logged in
    if (user?.id) {
      channelBuilder = channelBuilder.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fury_vault_qualifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            const newQual = payload.new as {
              is_qualified: boolean;
              total_bids_in_auction: number;
              vault_instance_id: string;
            };

            // Only process if it's for the current vault instance
            if (data.instance && newQual.vault_instance_id !== data.instance.id) return;

            // Debounce 150ms to batch rapid updates during bidding wars
            if (qualDebounceRef.current) {
              clearTimeout(qualDebounceRef.current);
            }
            qualDebounceRef.current = setTimeout(() => {
              setData(prev => {
                // Dedupe: skip if values haven't changed
                if (
                  prev.isQualified === newQual.is_qualified &&
                  prev.userBidsInAuction === newQual.total_bids_in_auction
                ) {
                  return prev;
                }
                return {
                  ...prev,
                  isQualified: newQual.is_qualified,
                  userBidsInAuction: newQual.total_bids_in_auction,
                };
              });
            }, 150);
          }
        }
      );
    }

    channelBuilder.subscribe();

    return () => {
      if (qualDebounceRef.current) {
        clearTimeout(qualDebounceRef.current);
      }
      supabase.removeChannel(channelBuilder);
    };
  }, [auctionId, user?.id, data.instance?.id]);

  // Correct bidsUntilNextIncrement using totalBids prop
  const interval = data.config?.accumulation_interval ?? 20;
  const currentTotalBids = totalBids ?? 0;
  const bidsIntoCurrentInterval = currentTotalBids > 0 ? currentTotalBids % interval : 0;
  const bidsUntilNextIncrement = bidsIntoCurrentInterval === 0 && currentTotalBids > 0 ? 0 : interval - bidsIntoCurrentInterval;

  return {
    ...data,
    currentValue: data.instance?.current_value ?? 0,
    isFuryMode: data.instance?.fury_mode_active ?? false,
    status: data.instance?.status ?? null,
    maxCap: data.instance?.max_cap ?? 0,
    topBidderAmount: data.instance?.top_bidder_amount ?? 0,
    rafflWinnerAmount: data.instance?.raffle_winner_amount ?? 0,
    hasVault: !!data.instance,
    bidsUntilNextIncrement,
    recencySeconds: data.config?.recency_seconds ?? 60,
    refetch: fetchData,
  };
};
