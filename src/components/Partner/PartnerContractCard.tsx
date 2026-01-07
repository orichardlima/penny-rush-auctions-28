import { FileText, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PartnerProgressBar } from './PartnerProgressBar';
import { PartnerContract } from '@/hooks/usePartnerData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PartnerContractCardProps {
  contract: PartnerContract;
  progressPercentage: number;
}

export const PartnerContractCard = ({ contract, progressPercentage }: PartnerContractCardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>;
      case 'CLOSED':
        return <Badge className="bg-muted text-muted-foreground">Encerrado</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">Suspenso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Contract Info Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Meu Contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plano</span>
            <Badge variant="outline" className="font-semibold">
              {contract.plan_name}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor do Aporte</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(Number(contract.aporte_value))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Limite Mensal</span>
            <span className="font-medium text-foreground">
              {formatCurrency(Number(contract.monthly_cap))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Recebido</span>
            <span className="font-semibold text-primary">
              {formatCurrency(Number(contract.total_received))}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {getStatusBadge(contract.status)}
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Desde
            </span>
            <span className="text-muted-foreground">
              {format(new Date(contract.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Progress Card */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Progresso até o Teto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerProgressBar
            totalReceived={Number(contract.total_received)}
            totalCap={Number(contract.total_cap)}
            progressPercentage={progressPercentage}
          />
          
          {contract.status === 'CLOSED' && contract.closed_reason && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Contrato Encerrado</p>
                <p className="text-muted-foreground">{contract.closed_reason}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
