import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Clock, Gift, TrendingUp, Trophy } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationSettings = () => {
  const { settings, updateSettings } = useNotifications();

  const notifications = [
    {
      key: 'auctionEndingSoon' as const,
      icon: Clock,
      title: 'Leilões terminando em breve',
      description: 'Receba notificações quando um leilão estiver terminando em menos de 30 segundos',
      enabled: settings.auctionEndingSoon,
    },
    {
      key: 'newAuctions' as const,
      icon: Gift,
      title: 'Novos leilões',
      description: 'Seja notificado quando novos leilões forem adicionados',
      enabled: settings.newAuctions,
    },
    {
      key: 'bidOutbid' as const,
      icon: TrendingUp,
      title: 'Lance superado',
      description: 'Receba notificações quando alguém superar seu lance',
      enabled: settings.bidOutbid,
    },
    {
      key: 'auctionWon' as const,
      icon: Trophy,
      title: 'Leilão ganho',
      description: 'Celebre suas vitórias com notificações de leilões ganhos',
      enabled: settings.auctionWon,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Configurações de Notificação
        </CardTitle>
        <CardDescription>
          Personalize quando e como você quer ser notificado sobre atividades dos leilões
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {notifications.map((notification) => (
          <div key={notification.key} className="flex items-start space-x-4">
            <div className="flex-shrink-0 mt-1">
              <notification.icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={notification.key} className="text-sm font-medium cursor-pointer">
                  {notification.title}
                </Label>
                <Switch
                  id={notification.key}
                  checked={notification.enabled}
                  onCheckedChange={(checked) =>
                    updateSettings({ [notification.key]: checked })
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {notification.description}
              </p>
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Dica:</strong> As notificações funcionam melhor quando você mantém esta aba aberta.
            Para notificações no desktop, permita notificações do navegador quando solicitado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};