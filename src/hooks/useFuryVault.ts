import { useState, useEffect, useCallback } from 'react';
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
}

interface FuryVaultConfig {
  accumulation_interval: number;
  min_bids_to_qualify: number;
  is_active: boolean;
}

interface FuryVaultData {
  instance: FuryVaultInstance | null;
  config: FuryVaultConfig | null;
  qualifiedCount: number;
  isQualified: boolean;
  userBidsInAuction: number;
  loading: boolean;
}

export const useFuryVault = (auctionId: string) => {
  const { user } = useAuth();
  const [data, setData] = useState<FuryVaultData>({
    instance: null,
    config: null,
    qualifiedCount: 0,
    isQualified: false,
    userBidsInAuction: 0,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    try {
      // Fetch instance + config + qualifications in parallel
      const [instanceRes, configRes] = await Promise.all([
        supabase
          .from('fury_vault_instances')
          .select('*')
          .eq('auction_id', auctionId)
          .maybeSingle(),
        supabase
          .from('fury_vault_config')
          .select('accumulation_interval, min_bids_to_qualify, is_active')
          .eq('is_active', true)
          .maybeSingle(),
      ]);

      const instance = instanceRes.data as FuryVaultInstance | null;
      const config = configRes.data as FuryVaultConfig | null;

      let qualifiedCount = 0;
      let isQualified = false;
      let userBidsInAuction = 0;

      if (instance) {
        const [qualCountRes, userQualRes] = await Promise.all([
          supabase
            .from('fury_vault_qualifications')
            .select('id', { count: 'exact', head: true })
            .eq('vault_instance_id', instance.id)
            .eq('is_qualified', true),
          user
            ? supabase
                .from('fury_vault_qualifications')
                .select('total_bids_in_auction, is_qualified')
                .eq('vault_instance_id', instance.id)
                .eq('user_id', user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        qualifiedCount = qualCountRes.count ?? 0;
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

  // Realtime subscription for vault instance updates
  useEffect(() => {
    const channel = supabase
      .channel(`fury-vault-${auctionId}`)
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
            setData(prev => ({
              ...prev,
              instance: payload.new as FuryVaultInstance,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  // Derived values
  const nextIncrementIn = data.config && data.instance
    ? data.config.accumulation_interval - ((data.instance.last_increment_at_bid || 0) % data.config.accumulation_interval === 0
        ? 0
        : (data.instance.last_increment_at_bid || 0) % data.config.accumulation_interval)
    : null;

  // Calculate how many bids until next increment based on total auction bids
  const bidsUntilNextIncrement = data.config && data.instance
    ? (() => {
        const interval = data.config.accumulation_interval;
        const lastBid = data.instance.last_increment_at_bid || 0;
        // We need to estimate total bids from last_increment_at_bid
        // The next increment happens at lastBid + interval
        const nextAt = lastBid + interval;
        // We don't have total_bids on instance, so approximate from increments
        return Math.max(interval - (lastBid > 0 ? 0 : 0), 0);
      })()
    : null;

  return {
    ...data,
    currentValue: data.instance?.current_value ?? 0,
    isFuryMode: data.instance?.fury_mode_active ?? false,
    status: data.instance?.status ?? null,
    maxCap: data.instance?.max_cap ?? 0,
    topBidderAmount: data.instance?.top_bidder_amount ?? 0,
    rafflWinnerAmount: data.instance?.raffle_winner_amount ?? 0,
    hasVault: !!data.instance,
    nextIncrementIn,
    refetch: fetchData,
  };
};
