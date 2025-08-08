import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, Users, Bot, DollarSign } from 'lucide-react';

interface AuctionFinancialData {
  auction_id: string;
  title: string;
  total_bids_count: number;
  user_bids_count: number;
  bot_bids_count: number;
  user_bids_percentage: number;
  bot_bids_percentage: number;
  real_revenue: number;
  revenue_target: number;
  target_percentage: number;
  current_price: number;
  market_value: number;
  roi_percentage: number;
  profit_margin: number;
  status: string;
}

interface AuctionFinancialCardProps {
  auction: AuctionFinancialData;
  onClick?: () => void;
}

export const AuctionFinancialCard: React.FC<AuctionFinancialCardProps> = ({ 
  auction, 
  onClick 
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'finished': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getTargetColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getROIColor = (roi: number) => {
    if (roi > 0) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-lg ${onClick ? 'hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold truncate max-w-[200px]">
            {auction.title}
          </CardTitle>
          <Badge 
            className={`${getStatusColor(auction.status)} text-white`}
            variant="secondary"
          >
            {auction.status === 'active' ? 'Ativo' : 
             auction.status === 'finished' ? 'Finalizado' : 'Pendente'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Receita Real */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Receita Real
          </span>
          <span className="font-semibold text-lg">
            {formatCurrency(auction.real_revenue)}
          </span>
        </div>

        {/* Meta de Receita */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Meta
            </span>
            <span className={`font-semibold ${getTargetColor(auction.target_percentage)}`}>
              {auction.target_percentage.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={Math.min(auction.target_percentage, 100)} 
            className="h-2"
          />
          <div className="text-xs text-muted-foreground text-right">
            {formatCurrency(auction.revenue_target / 100)}
          </div>
        </div>

        {/* Lances: Usuários vs Bots */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              Usuários
            </div>
            <div className="font-semibold">{auction.user_bids_count}</div>
            <div className="text-xs text-green-600">
              {auction.user_bids_percentage.toFixed(1)}%
            </div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Bot className="h-3 w-3" />
              Bots
            </div>
            <div className="font-semibold">{auction.bot_bids_count}</div>
            <div className="text-xs text-orange-600">
              {auction.bot_bids_percentage.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* ROI e Margem */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">ROI</div>
            <div className={`font-semibold flex items-center justify-center gap-1 ${getROIColor(auction.roi_percentage)}`}>
              {auction.roi_percentage > 0 ? 
                <TrendingUp className="h-3 w-3" /> : 
                <TrendingDown className="h-3 w-3" />
              }
              {auction.roi_percentage.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Margem</div>
            <div className={`font-semibold ${getROIColor(auction.profit_margin)}`}>
              {formatCurrency(auction.profit_margin)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};