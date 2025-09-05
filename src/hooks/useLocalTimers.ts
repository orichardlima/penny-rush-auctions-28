import { useEffect } from 'react';

export const useLocalTimers = (
  auctions: any[],
  updateAuction: (id: string, updates: any) => void
) => {
  useEffect(() => {
    const interval = setInterval(() => {
      auctions.forEach(auction => {
        if (auction.status === 'active') {
          // Simple countdown logic - only decrement time_left
          const newTimer = Math.max(0, auction.time_left - 1);
          
          if (newTimer !== auction.time_left) {
            updateAuction(auction.id, { time_left: newTimer });
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [auctions, updateAuction]);
};