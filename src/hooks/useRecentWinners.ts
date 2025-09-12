import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Winner {
  id: string;
  name: string;
  product: string;
  originalPrice: number;
  finalPrice: number;
  savings: number;
  date: string;
  avatar: string;
}

export const useRecentWinners = () => {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentWinners();
  }, []);

  const fetchRecentWinners = async () => {
    try {
      setLoading(true);
      
      const { data: auctions, error: auctionsError } = await supabase
        .from('auctions')
        .select(`
          id,
          title,
          market_value,
          current_price,
          finished_at,
          winner_id,
          winner_name
        `)
        .eq('status', 'finished')
        .not('winner_id', 'is', null)
        .not('winner_name', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(6);

      if (auctionsError) {
        throw auctionsError;
      }

      if (auctions && auctions.length > 0) {
        // Get winner profiles separately
        const winnerIds = auctions.map(a => a.winner_id).filter(Boolean);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, city, state, full_name')
          .in('user_id', winnerIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const formattedWinners: Winner[] = auctions.map((auction) => {
          const profile = profileMap.get(auction.winner_id);
          const city = profile?.city || '';
          const state = profile?.state || '';
          const fullName = auction.winner_name || profile?.full_name || 'Usuário';
          
          // Format name with region
          const nameWithRegion = city && state 
            ? `${fullName} - ${city}, ${state}`
            : fullName;
          
          // Calculate savings
          const savings = auction.market_value - auction.current_price;
          
          // Format date
          const finishedDate = new Date(auction.finished_at);
          const now = new Date();
          const diffInHours = Math.floor((now.getTime() - finishedDate.getTime()) / (1000 * 60 * 60));
          
          let dateString;
          if (diffInHours < 1) {
            dateString = 'Há poucos minutos';
          } else if (diffInHours < 24) {
            dateString = `Há ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
          } else {
            const diffInDays = Math.floor(diffInHours / 24);
            dateString = `Há ${diffInDays} dia${diffInDays > 1 ? 's' : ''}`;
          }
          
          // Generate avatar initials
          const names = fullName.split(' ');
          const avatar = names.length >= 2 
            ? (names[0][0] + names[1][0]).toUpperCase()
            : fullName.substring(0, 2).toUpperCase();

          return {
            id: auction.id,
            name: nameWithRegion,
            product: auction.title,
            originalPrice: auction.market_value,
            finalPrice: auction.current_price,
            savings,
            date: dateString,
            avatar
          };
        });

        setWinners(formattedWinners);
      } else {
        // Fallback to static data if no real winners
        setWinners(getStaticWinners());
      }
    } catch (err) {
      console.error('Error fetching winners:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar vencedores');
      // Fallback to static data on error
      setWinners(getStaticWinners());
    } finally {
      setLoading(false);
    }
  };

  const getStaticWinners = (): Winner[] => [
    {
      id: '1',
      name: "Maria S. - Campinas, SP",
      product: "iPhone 15 Pro Max",
      originalPrice: 8999,
      finalPrice: 23.45,
      savings: 8975.55,
      date: "Há 2 horas",
      avatar: "MS"
    },
    {
      id: '2',
      name: "João P. - Ribeirão Preto, SP",
      product: "MacBook Air M2",
      originalPrice: 12999,
      finalPrice: 156.78,
      savings: 12842.22,
      date: "Há 5 horas",
      avatar: "JP"
    },
    {
      id: '3',
      name: "Ana L. - Caxias do Sul, RS",
      product: "Samsung Galaxy S24",
      originalPrice: 5499,
      finalPrice: 89.23,
      savings: 5409.77,
      date: "Há 8 horas",
      avatar: "AL"
    },
    {
      id: '4',
      name: "Carlos M. - Feira de Santana, BA",
      product: "PlayStation 5",
      originalPrice: 4199,
      finalPrice: 67.89,
      savings: 4131.11,
      date: "Há 12 horas",
      avatar: "CM"
    },
    {
      id: '5',
      name: "Fernanda R. - Londrina, PR",
      product: "Smart TV 55'' 4K",
      originalPrice: 3299,
      finalPrice: 45.67,
      savings: 3253.33,
      date: "Há 1 dia",
      avatar: "FR"
    },
    {
      id: '6',
      name: "Ricardo T. - Joinville, SC",
      product: "Apple Watch Ultra",
      originalPrice: 7999,
      finalPrice: 123.45,
      savings: 7875.55,
      date: "Há 1 dia",
      avatar: "RT"
    }
  ];

  return { winners, loading, error };
};