import { History, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PartnerPayout } from '@/hooks/usePartnerData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PartnerPayoutsHistoryProps {
  payouts: PartnerPayout[];
}

export const PartnerPayoutsHistory = ({ payouts }: PartnerPayoutsHistoryProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return format(date, "MMM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge className="bg-success/20 text-success border-success/30 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Pago
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (payouts.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-primary" />
            Histórico de Repasses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum repasse registrado ainda.</p>
            <p className="text-sm mt-1">Os repasses são calculados mensalmente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          Histórico de Repasses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Limites Aplicados</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell className="font-medium capitalize">
                  {formatMonth(payout.month)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-semibold text-primary">
                      {formatCurrency(Number(payout.amount))}
                    </span>
                    {Number(payout.calculated_amount) !== Number(payout.amount) && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(Number(payout.calculated_amount))}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    {payout.monthly_cap_applied && (
                      <Badge variant="outline" className="text-xs">Mensal</Badge>
                    )}
                    {payout.total_cap_applied && (
                      <Badge variant="outline" className="text-xs">Teto</Badge>
                    )}
                    {!payout.monthly_cap_applied && !payout.total_cap_applied && (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(payout.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
