import { useState, useMemo } from 'react';
import { FilterState } from '@/components/AuctionFilters';

interface Auction {
  id: string;
  title: string;
  currentPrice: number;
  originalPrice: number;
  totalBids: number;
  participants: number;
  auctionStatus: string;
  timeLeft: number;
  created_at: string;
  image: string;
  recentBidders: string[];
  currentRevenue: number;
  isActive: boolean;
  ends_at?: string;
  starts_at?: string;
  winnerId?: string;
  winnerName?: string;
}

export const useAuctionFilters = (auctions: Auction[]) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    priceRange: [0, 10000],
    sortBy: 'newest',
  });

  const filteredAuctions = useMemo(() => {
    let result = [...auctions];

    // Filtro por busca
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(auction =>
        auction.title.toLowerCase().includes(searchLower)
      );
    }

    // Filtro por status
    if (filters.status !== 'all') {
      result = result.filter(auction => auction.auctionStatus === filters.status);
    }

    // Filtro por faixa de preço
    result = result.filter(auction =>
      auction.currentPrice >= filters.priceRange[0] &&
      auction.currentPrice <= filters.priceRange[1]
    );

    // Ordenação
    switch (filters.sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'price_low':
        result.sort((a, b) => a.currentPrice - b.currentPrice);
        break;
      case 'price_high':
        result.sort((a, b) => b.currentPrice - a.currentPrice);
        break;
      case 'ending_soon':
        result.sort((a, b) => {
          // Leilões ativos primeiro, ordenados por tempo restante
          if (a.auctionStatus === 'active' && b.auctionStatus !== 'active') return -1;
          if (a.auctionStatus !== 'active' && b.auctionStatus === 'active') return 1;
          if (a.auctionStatus === 'active' && b.auctionStatus === 'active') {
            return a.timeLeft - b.timeLeft;
          }
          // Para não ativos, ordenar por status (waiting antes de finished)
          const statusOrder = { waiting: 1, finished: 2 };
          return (statusOrder[a.auctionStatus as keyof typeof statusOrder] || 3) - 
                 (statusOrder[b.auctionStatus as keyof typeof statusOrder] || 3);
        });
        break;
    }

    return result;
  }, [auctions, filters]);

  return {
    filters,
    setFilters,
    filteredAuctions,
    totalResults: filteredAuctions.length,
  };
};