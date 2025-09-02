import { useEffect } from 'react';

/**
 * 🎯 OPÇÃO A - Hook para atualizar timers locais em tempo real
 * Este hook atualiza os timers a cada segundo no frontend
 */
export const useLocalTimers = (
  auctions: any[],
  updateAuction: (id: string, updates: any) => void
) => {
  useEffect(() => {
    const interval = setInterval(() => {
      auctions.forEach(auction => {
        if (auction.status === 'active' && auction.local_timer) {
          const now = new Date();
          const lastActivity = new Date(auction.updated_at);
          const secondsSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / 1000);
          const newTimer = Math.max(0, 15 - secondsSinceActivity);
          
          // Só atualizar se o timer mudou
          if (newTimer !== auction.time_left) {
            updateAuction(auction.id, { time_left: newTimer });
            
            // Log apenas quando o timer muda
            console.log(`⏱️ [LOCAL-TIMER] ${auction.title}: ${newTimer}s`);
          }
        }
      });
    }, 1000); // Atualizar a cada segundo

    return () => clearInterval(interval);
  }, [auctions, updateAuction]);
};