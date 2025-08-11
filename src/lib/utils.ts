import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toZonedTime } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const transformAuctionData = (auction: any) => {
  const brazilTimezone = 'America/Sao_Paulo';
  const now = new Date();
  const nowInBrazil = toZonedTime(now, brazilTimezone);
  
  const startsAt = auction.starts_at ? toZonedTime(new Date(auction.starts_at), brazilTimezone) : null;
  const endsAt = auction.ends_at ? toZonedTime(new Date(auction.ends_at), brazilTimezone) : null;
  
  // Determinar o status real do leilão usando o fuso do Brasil
  let auctionStatus = 'waiting';
  if (startsAt && startsAt > nowInBrazil) {
    auctionStatus = 'waiting'; // Ainda não começou
  } else if (auction.status === 'active' && (!endsAt || endsAt > nowInBrazil)) {
    auctionStatus = 'active'; // Ativo
  } else {
    auctionStatus = 'finished'; // Finalizado
  }
  
  return {
    ...auction,
    image: auction.image_url || '/placeholder.svg',
    currentPrice: (auction.current_price || 10) / 100,
    originalPrice: (auction.market_value || 0) / 100,
    totalBids: auction.total_bids || 0,
    participants: auction.participants_count || 0,
    recentBidders: auction.recentBidders || [], // Usar dados reais dos lances
    currentRevenue: (auction.total_bids || 0) * 1.00,
    timeLeft: endsAt ? Math.max(0, Math.floor((endsAt.getTime() - nowInBrazil.getTime()) / 1000)) : 0,
    auctionStatus,
    isActive: auctionStatus === 'active',
    ends_at: auction.ends_at,
    starts_at: auction.starts_at
  };
};
