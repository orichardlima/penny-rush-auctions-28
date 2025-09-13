import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [notifiedAuctions, setNotifiedAuctions] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  // Monitorar leilões terminando em breve
  useEffect(() => {
    if (!settings.auctionEndingSoon || !user) return;

    const channel = supabase
      .channel('auction-ending-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions'
        },
        (payload) => {
          const auction = payload.new as any;
          if (
            auction.status === 'active' &&
            auction.time_left <= 30 &&
            auction.time_left > 0 &&
            !notifiedAuctions.has(auction.id)
          ) {
            toast({
              title: "⏰ Leilão terminando em breve!",
              description: `${auction.title} termina em ${auction.time_left} segundos`,
              duration: 5000,
            });
            setNotifiedAuctions(prev => new Set(prev).add(auction.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings.auctionEndingSoon, user, toast]);

  // Monitorar novos leilões
  useEffect(() => {
    if (!settings.newAuctions || !user) return;

    const channel = supabase
      .channel('new-auction-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auctions'
        },
        (payload) => {
          const auction = payload.new as any;
          if (auction.status === 'active' || auction.status === 'waiting') {
            toast({
              title: "🆕 Novo leilão disponível!",
              description: `${auction.title} acabou de ser adicionado`,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings.newAuctions, user, toast]);

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