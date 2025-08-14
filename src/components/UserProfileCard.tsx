import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Clock, Target, TrendingUp, Calendar, User } from 'lucide-react';
import { useUserAnalytics } from '@/hooks/useUserAnalytics';

interface UserProfileCardProps {
  userId: string;
  userName: string;
  userEmail?: string;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userId,
  userName,
  userEmail
}) => {
  const { analytics, loading, error } = useUserAnalytics(userId);

  if (loading) {
    return (
      <Card>
        <CardContent className="animate-pulse p-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-muted rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Erro ao carregar dados do usuário</p>
        </CardContent>
      </Card>
    );
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'VIP': return 'bg-purple-100 text-purple-800';
      case 'Premium': return 'bg-yellow-100 text-yellow-800';
      case 'Ativo': return 'bg-green-100 text-green-800';
      case 'Casual': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const winRate = analytics.auctions_participated > 0 
    ? (analytics.auctions_won / analytics.auctions_participated * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {userName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {userName}
            </CardTitle>
            <CardDescription>{userEmail}</CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge className={getClassificationColor(analytics.user_classification)}>
                {analytics.user_classification}
              </Badge>
              {analytics.is_bot && (
                <Badge variant="secondary">Bot</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-primary/5 rounded-lg">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">Total Gasto</p>
            <p className="text-lg font-bold text-primary">R$ {analytics.total_spent.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Target className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-sm font-medium">Total Lances</p>
            <p className="text-lg font-bold text-blue-600">{analytics.total_bids}</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-sm font-medium">Leilões Ganhos</p>
            <p className="text-lg font-bold text-green-600">{analytics.auctions_won}</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Clock className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-sm font-medium">Taxa de Vitória</p>
            <p className="text-lg font-bold text-purple-600">{winRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Estatísticas detalhadas */}
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Estatísticas Detalhadas
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leilões Participados:</span>
                <span className="font-medium">{analytics.auctions_participated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Médio por Lance:</span>
                <span className="font-medium">R$ {analytics.avg_bid_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horário Favorito:</span>
                <span className="font-medium">{analytics.favorite_time_slot}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primeira Atividade:</span>
                <span className="font-medium">
                  {analytics.first_activity 
                    ? new Date(analytics.first_activity).toLocaleDateString('pt-BR')
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última Atividade:</span>
                <span className="font-medium">
                  {analytics.last_activity 
                    ? new Date(analytics.last_activity).toLocaleDateString('pt-BR')
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Eficiência:</span>
                <span className="font-medium">
                  {analytics.total_bids > 0 
                    ? `${(analytics.total_spent / analytics.total_bids).toFixed(2)} R$/lance`
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Análise comportamental */}
        {analytics.user_classification !== 'Inativo' && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h5 className="font-medium mb-2">Análise Comportamental</h5>
            <p className="text-sm text-muted-foreground">
              {analytics.user_classification === 'VIP' && 
                "Usuário premium com alto valor de gastos. Estratégias personalizadas recomendadas."
              }
              {analytics.user_classification === 'Premium' && 
                "Usuário com gastos significativos. Potencial para upgrades VIP."
              }
              {analytics.user_classification === 'Ativo' && 
                "Usuário engajado com boa frequência de lances. Oportunidade de aumentar gastos."
              }
              {analytics.user_classification === 'Casual' && 
                "Usuário ocasional. Estratégias de engajamento podem aumentar atividade."
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserProfileCard;