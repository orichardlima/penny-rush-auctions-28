import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toZonedTime } from "date-fns-tz";
import { formatUserNameForDisplay } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getErrorToast } from "@/utils/errorHandler";

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

export const useAuctionData = () => {
  const [auctions, setAuctions] = useState<AuctionData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
      timeLeft: endsAt 
        ? Math.max(0, Math.floor((endsAt.getTime() - nowInBrazil.getTime()) / 1000)) 
        : 0,
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
        toast(getErrorToast(error));
        return;
      }

      // Processar em paralelo mas preservar ordem original do banco
      const auctionsWithBidders = await Promise.all(
        (data || []).map(async (auction, index) => {
          const recentBidders = await fetchRecentBidders(auction.id);
          const transformed = await transformAuctionData({ ...auction, recentBidders });
          return { ...transformed, _originalIndex: index };
        })
      );

      // Ordenar pela ordem original do banco antes de setar o state
      auctionsWithBidders.sort((a, b) => a._originalIndex - b._originalIndex);
      
      // Remover o campo auxiliar e setar o state
      const cleanAuctions = auctionsWithBidders.map(({ _originalIndex, ...auction }) => auction) as AuctionData[];
      setAuctions(cleanAuctions);
    } catch (error) {
      toast(getErrorToast(error));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateAuction = async (auctionId: string, newData: any) => {
    const recentBidders = await fetchRecentBidders(auctionId);
    const updatedAuction = await transformAuctionData({ ...newData, recentBidders });
    setAuctions(prev => 
      prev.map(auction => auction.id === updatedAuction.id ? updatedAuction : auction)
    );
  };

  const addAuction = async (newData: any) => {
    const recentBidders = await fetchRecentBidders(newData.id);
    const newAuction = await transformAuctionData({ ...newData, recentBidders });
    if (newAuction.status === 'active' || newAuction.status === 'waiting') {
      setAuctions(prev => [newAuction, ...prev]);
    }
    return newAuction;
  };

  const updateRecentBidders = async (auctionId: string) => {
    const recentBidders = await fetchRecentBidders(auctionId);
    setAuctions(prev => 
      prev.map(auction => 
        auction.id === auctionId ? { ...auction, recentBidders } : auction
      )
    );
  };

  return {
    auctions,
    loading,
    fetchAuctions,
    updateAuction,
    addAuction,
    updateRecentBidders,
    setAuctions,
    fetchRecentBidders,
    transformAuctionData
  };
};
