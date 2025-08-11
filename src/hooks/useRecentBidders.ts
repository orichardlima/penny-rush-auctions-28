import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserNameCache } from '@/contexts/UserNameCacheContext';
import { useIsMobile } from '@/hooks/use-mobile';

export const useRecentBidders = () => {
  const [loading, setLoading] = useState(false);
  const { getCachedNames } = useUserNameCache();
  const isMobile = useIsMobile();

  const fetchRecentBidders = useCallback(async (auctionId: string): Promise<string[]> => {
    setLoading(true);
    try {
      if (isMobile) {
        console.log(`📱 Mobile: Buscando lances recentes para leilão ${auctionId}`);
      }

      // Use a single optimized query with LEFT JOIN
      const { data: bidData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          user_id, 
          created_at,
          profiles!inner(user_id, full_name)
        `)
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (bidsError) {
        console.error('Erro ao buscar lances recentes:', bidsError);
        
        // Fallback to separate queries
        const { data: bids } = await supabase
          .from('bids')
          .select('user_id, created_at')
          .eq('auction_id', auctionId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!bids || bids.length === 0) {
          return [];
        }

        const userIds = bids.map(bid => bid.user_id);
        const nameMap = await getCachedNames(userIds);
        
        return bids.map(bid => nameMap[bid.user_id] || 'Usuário');
      }

      if (!bidData || bidData.length === 0) {
        return [];
      }

      // Extract names from JOIN result, with fallback to cache
      const result: string[] = [];
      const fallbackUserIds: string[] = [];

      bidData.forEach(bid => {
        // @ts-ignore - profiles is from the JOIN
        const profileName = bid.profiles?.full_name?.trim();
        if (profileName) {
          result.push(profileName);
        } else {
          result.push('Usuário');
          fallbackUserIds.push(bid.user_id);
        }
      });

      // Try to get missing names from cache as fallback
      if (fallbackUserIds.length > 0) {
        const nameMap = await getCachedNames(fallbackUserIds);
        let fallbackIndex = 0;
        
        for (let i = 0; i < result.length; i++) {
          if (result[i] === 'Usuário' && fallbackIndex < fallbackUserIds.length) {
            const userId = fallbackUserIds[fallbackIndex];
            result[i] = nameMap[userId] || 'Usuário';
            fallbackIndex++;
          }
        }
      }

      if (isMobile) {
        console.log(`📱 Mobile: ${result.length} nomes carregados para leilão ${auctionId}:`, result);
      }

      return result;
    } catch (error) {
      console.error('Erro ao buscar lances recentes:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getCachedNames, isMobile]);

  return { fetchRecentBidders, loading };
};