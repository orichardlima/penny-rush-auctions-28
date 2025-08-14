import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AuctionParticipant {
  user_id: string;
  user_name: string;
  is_bot: boolean;
  total_spent: number;
  bid_count: number;
  first_bid_at: string;
  last_bid_at: string;
  avg_time_between_bids: string;
}

export const useAuctionParticipants = (auctionId: string | null) => {
  const [participants, setParticipants] = useState<AuctionParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auctionId) {
      setParticipants([]);
      return;
    }

    const fetchParticipants = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.rpc('get_auction_participants', {
          auction_uuid: auctionId
        });

        if (error) throw error;
        setParticipants((data || []).map(p => ({
          ...p,
          avg_time_between_bids: String(p.avg_time_between_bids || '00:00:00')
        })));
      } catch (err) {
        console.error('Error fetching auction participants:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar participantes');
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [auctionId]);

  return { participants, loading, error };
};