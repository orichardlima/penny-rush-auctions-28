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
        if (auction.status === 'active' && auction.local_timer && auction.timer_start_time) {
          // Calcular baseado no timer_start_time fixo
          const now = new Date();
          const timerStartTime = new Date(auction.timer_start_time);
          const secondsSinceStart = Math.floor((now.getTime() - timerStartTime.getTime()) / 1000);
          const newTimer = Math.max(0, 15 - secondsSinceStart);
          
          // Debug detalhado
          console.log(`⏰ [LOCAL-TIMER] ${auction.title}: ${newTimer}s (${secondsSinceStart}s elapsed)`);
          
          // Só atualizar se o timer mudou E é diferente do atual
          if (newTimer !== auction.time_left) {
            console.log(`📉 [TIMER-UPDATE] ${auction.title}: ${auction.time_left}s → ${newTimer}s`);
            updateAuction(auction.id, { time_left: newTimer });
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // ✅ Dependências fixas - evita recriação do interval
};