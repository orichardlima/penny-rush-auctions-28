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
        if (auction.status === 'active' && auction.local_timer) {
          // Calcular baseado no timer_start_time (momento em que o timer foi iniciado)
          const now = new Date();
          const timerStartTime = new Date(auction.timer_start_time || auction.last_bid_time || auction.starts_at);
          const secondsSinceStart = Math.floor((now.getTime() - timerStartTime.getTime()) / 1000);
          const newTimer = Math.max(0, 15 - secondsSinceStart);
          
          // Só atualizar se o timer mudou
          if (newTimer !== auction.time_left) {
            updateAuction(auction.id, { time_left: newTimer });
          }
        }
      });
    }, 1000); // Atualizar a cada segundo

    return () => clearInterval(interval);
  }, [auctions, updateAuction]);
};