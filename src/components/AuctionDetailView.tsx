import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useFinishAuction } from '@/hooks/useFinishAuction';
import AuctionParticipantsTable from './AuctionParticipantsTable';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  Bot, 
  DollarSign,
  Calendar,
  Clock,
  Trophy,
  BarChart3,
  Eye,
  Activity,
  Flag,
  Loader2
} from 'lucide-react';

interface Auction {
  id: string;
  title: string;
  description: string;
  image_url: string;
  current_price: number;
  starting_price: number;
  market_value: number;
  revenue_target: number;
  total_bids: number;
  time_left: number;
  status: string;
  winner_name?: string;
  winner_id?: string;
  participants_count: number;
  finished_at?: string;
  ends_at?: string;
  company_revenue: number;
  created_at: string;
  starts_at: string;
}

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

interface AuctionDetailViewProps {
  auction: Auction;
  financialData?: AuctionFinancialData;
}

export const AuctionDetailView: React.FC<AuctionDetailViewProps> = ({
  auction,
  financialData
}) => {
  const { profile } = useAuth();
  const { finishAuction, isFinishing } = useFinishAuction();
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const isAdmin = profile?.is_admin;
  const canFinish = isAdmin && auction.status === 'active';
  // Removida formatCurrency com divisão por 100 - agora só usamos formatCurrencyFromReais

  const formatCurrencyFromReais = (valueInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valueInReais);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'finished': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'finished': return 'Finalizado';
      case 'pending': return 'Pendente';
      default: return status;
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
    <div className="space-y-6">
      {/* Header com informações básicas do leilão */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Imagem do produto */}
            <div className="w-full lg:w-1/3">
              {auction.image_url ? (
                <img 
                  src={auction.image_url} 
                  alt={auction.title}
                  className="w-full h-48 lg:h-64 object-cover rounded-lg border"
                />
              ) : (
                <div className="w-full h-48 lg:h-64 bg-muted rounded-lg flex items-center justify-center">
                  <Eye className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
            </div>

            {/* Informações principais */}
            <div className="flex-1 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{auction.title}</h1>
                  <p className="text-muted-foreground text-lg">{auction.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    className={`${getStatusColor(auction.status)} text-white px-3 py-1`}
                    variant="secondary"
                  >
                    {getStatusLabel(auction.status)}
                  </Badge>
                  
                  {canFinish && (
                    <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="gap-2"
                          disabled={isFinishing}
                        >
                          {isFinishing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Flag className="h-4 w-4" />
                          )}
                          Encerrar Leilão
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Encerrar Leilão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja encerrar este leilão agora? 
                            O último usuário que deu lance será declarado vencedor.
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              const success = await finishAuction(auction.id);
                              if (success) {
                                setShowFinishDialog(false);
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Sim, Encerrar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {/* Informações temporais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Início:</span>
                  <span className="font-medium">{formatDate(auction.starts_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {auction.status === 'finished' ? 'Finalizado:' : 'Fim:'}
                  </span>
                  <span className="font-medium">
                    {formatDate(auction.finished_at || auction.ends_at)}
                  </span>
                </div>
              </div>

              {/* Vencedor (se houver) */}
              {auction.winner_name && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Trophy className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">
                    Vencedor: {auction.winner_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas Financeiras e de Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Valores e Preços */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Valores e Preços
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 font-medium mb-1">Preço Atual</div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrencyFromReais(auction.current_price)}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-600 font-medium mb-1">Valor de Mercado</div>
                <div className="text-2xl font-bold text-purple-700">
                  {formatCurrencyFromReais(auction.market_value)}
                </div>
              </div>
            </div>

            {financialData && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Receita Real</span>
                  <span className="font-semibold text-lg">
                    {formatCurrencyFromReais(financialData.real_revenue)}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Meta de Receita</span>
                    <span className={`font-semibold ${getTargetColor(financialData.target_percentage)}`}>
                      {financialData.target_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(financialData.target_percentage, 100)} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    Meta: {formatCurrencyFromReais(financialData.revenue_target)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividade e Participação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade e Participação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 font-medium mb-1">Total de Lances</div>
                <div className="text-2xl font-bold text-green-700">
                  {auction.total_bids}
                </div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-sm text-orange-600 font-medium mb-1">Participantes</div>
                <div className="text-2xl font-bold text-orange-700">
                  {auction.participants_count}
                </div>
              </div>
            </div>

            {financialData && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    Lances de Usuários
                  </div>
                  <div className="font-semibold text-lg">{financialData.user_bids_count}</div>
                  <div className="text-xs text-green-600">
                    {financialData.user_bids_percentage.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <Bot className="h-3 w-3" />
                    Lances de Bots
                  </div>
                  <div className="font-semibold text-lg">{financialData.bot_bids_count}</div>
                  <div className="text-xs text-orange-600">
                    {financialData.bot_bids_percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Financeira (ROI e Margem) */}
      {financialData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Financeira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">ROI (Return on Investment)</div>
                <div className={`text-3xl font-bold flex items-center justify-center gap-2 ${getROIColor(financialData.roi_percentage)}`}>
                  {financialData.roi_percentage > 0 ? 
                    <TrendingUp className="h-6 w-6" /> : 
                    <TrendingDown className="h-6 w-6" />
                  }
                  {financialData.roi_percentage.toFixed(1)}%
                </div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Margem de Lucro</div>
                <div className={`text-3xl font-bold ${getROIColor(financialData.profit_margin)}`}>
                  {formatCurrencyFromReais(financialData.profit_margin)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Tabela de Participantes */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Participantes do Leilão</h2>
        <AuctionParticipantsTable
          auctionId={auction.id}
          auctionTitle={auction.title}
        />
      </div>
    </div>
  );
};