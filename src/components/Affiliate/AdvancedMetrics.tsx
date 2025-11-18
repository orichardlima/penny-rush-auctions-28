import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Target, Clock, Wallet } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface AdvancedMetricsProps {
  totalConversions: number;
  totalCommissionEarned: number;
  commissionBalance: number;
}

export function AdvancedMetrics({ 
  totalConversions, 
  totalCommissionEarned,
  commissionBalance 
}: AdvancedMetricsProps) {
  const averageTicket = totalConversions > 0 
    ? totalCommissionEarned / totalConversions 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          <Target className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPrice(averageTicket)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Por conversão
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">+0%</div>
          <p className="text-xs text-muted-foreground mt-1">
            vs período anterior
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendente</CardTitle>
          <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPrice(0)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Aguardando aprovação
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disponível</CardTitle>
          <Wallet className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPrice(commissionBalance)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Pronto para saque
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
