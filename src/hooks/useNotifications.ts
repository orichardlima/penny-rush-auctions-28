import { useState, useEffect, useCallback } from 'react';

interface NotificationSettings {
  auctionEndingSoon: boolean;
  newAuctions: boolean;
  bidOutbid: boolean;
  auctionWon: boolean;
}

export const useNotifications = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    auctionEndingSoon: true,
    newAuctions: true,
    bidOutbid: true,
    auctionWon: true,
  });

  // Notificações agora são tratadas pelo AuctionRealtimeContext
  // (novo leilão = INSERT handler, leilão terminando = timer local)
  // Este hook mantém apenas as configurações/toggles de preferência

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    
    // Salvar no localStorage
    const updatedSettings = { ...settings, ...newSettings };
    localStorage.setItem('notificationSettings', JSON.stringify(updatedSettings));
  }, [settings]);

  // Carregar configurações do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (error) {
        console.error('Erro ao carregar configurações de notificação:', error);
      }
    }
  }, []);

  return {
    settings,
    updateSettings,
  };
};