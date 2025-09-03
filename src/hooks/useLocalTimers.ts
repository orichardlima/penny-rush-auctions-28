import { useEffect } from 'react';

export const useLocalTimers = (
  auctions: any[],
  updateAuction: (id: string, updates: any) => void
) => {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      auctions.forEach(auction => {
        if (auction.status === 'active' && auction.timer_start_time) {
          const timerStartTime = new Date(auction.timer_start_time).getTime();
          const secondsSinceStart = Math.floor((now - timerStartTime) / 1000);

          const duration = auction.duration ?? 15;
          const newTimer = Math.max(0, duration - secondsSinceStart);

          if (newTimer !== auction.time_left) {
            updateAuction(auction.id, { time_left: newTimer });
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [auctions, updateAuction]);
};