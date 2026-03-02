import { useEffect } from 'react';

export const useAuctionTimer = (onAuctionUpdate: () => void) => {
  useEffect(() => {
    // Apenas refresh periódico - ativação é 100% server-side (bot_protection_loop)
    const statusCheckInterval = setInterval(() => {
      onAuctionUpdate();
    }, 60000); // 1 minuto

    return () => {
      clearInterval(statusCheckInterval);
    };
  }, [onAuctionUpdate]);
};
