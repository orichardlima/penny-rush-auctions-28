import { useEffect } from 'react';

/**
 * 🎯 Hook para atualizar timers locais em tempo real
 * Este hook atualiza os timers a cada segundo baseado no último bid real
 */
export const useLocalTimers = (
  auctions: any[],
  updateAuction: (id: string, updates: any) => void
) => {
  useEffect(() => {
    const interval = setInterval(() => {
      auctions.forEach(auction => {
        if (auction.status === 'active' && auction.local_timer && auction.last_bid_time) {
          const now = new Date();
          const lastBidTime = new Date(auction.last_bid_time);
          const secondsSinceLastBid = Math.floor((now.getTime() - lastBidTime.getTime()) / 1000);
          const newTimer = Math.max(0, 15 - secondsSinceLastBid);
          
          // Só atualizar se o timer mudou
          if (newTimer !== auction.time_left) {
            updateAuction(auction.id, { time_left: newTimer });
            
            // Log apenas quando o timer muda
            console.log(`⏱️ [LOCAL-TIMER] ${auction.title}: ${newTimer}s (desde último bid: ${secondsSinceLastBid}s)`);
          }
        }
      });
    }, 1000); // Atualizar a cada segundo

    return () => clearInterval(interval);
  }, [auctions, updateAuction]);
};