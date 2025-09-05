import { useEffect } from 'react';

export const useLocalTimers = (
  auctions: any[],
  updateAuction: (id: string, updates: any) => void
) => {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      auctions.forEach(auction => {
        if (auction.status === 'active') {
          let newTimer = auction.time_left;
          
          // Use ends_at as primary timer source if available and valid
          if (auction.ends_at) {
            const endsAtTime = new Date(auction.ends_at).getTime();
            const secondsLeft = Math.max(0, Math.floor((endsAtTime - now) / 1000));
            
            // Only update if significantly different to avoid jitter
            if (Math.abs(secondsLeft - auction.time_left) > 1) {
              newTimer = secondsLeft;
            } else {
              // Use local countdown when close to avoid server sync issues
              newTimer = Math.max(0, auction.time_left - 1);
            }
          } else if (auction.timer_start_time) {
            // Fallback to timer_start_time logic
            const timerStartTime = new Date(auction.timer_start_time).getTime();
            const secondsSinceStart = Math.floor((now - timerStartTime) / 1000);
            const duration = auction.duration ?? 15;
            newTimer = Math.max(0, duration - secondsSinceStart);
          } else {
            // Simple countdown when no reference available
            newTimer = Math.max(0, auction.time_left - 1);
          }

          if (newTimer !== auction.time_left) {
            updateAuction(auction.id, { time_left: newTimer });
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [auctions, updateAuction]);
};