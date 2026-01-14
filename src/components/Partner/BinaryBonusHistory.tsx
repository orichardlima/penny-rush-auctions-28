import React from 'react';
import { useBinaryNetwork, BinaryBonus } from '@/hooks/useBinaryNetwork';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Trophy, 
  Calendar,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatPrice = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateString: string) => {
  return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const getStatusBadge = (status: BinaryBonus['status']) => {
  const config = {
    PENDING: { label: 'Pendente', variant: 'outline' as const, icon: Clock },
    AVAILABLE: { label: 'Disponível', variant: 'default' as const, icon: CheckCircle },
    PAID: { label: 'Pago', variant: 'secondary' as const, icon: CheckCircle },
    CANCELLED: { label: 'Cancelado', variant: 'destructive' as const, icon: XCircle }
  };

  const { label, variant, icon: Icon } = config[status] || config.PENDING;

  return (
    <Badge variant={variant} className="flex items-center gap-1 w-fit">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
};

export const BinaryBonusHistory: React.FC = () => {
  const { bonuses, loading } = useBinaryNetwork();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalReceived = bonuses
    .filter(b => b.status === 'AVAILABLE' || b.status === 'PAID')
    .reduce((sum, b) => sum + b.bonus_value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Histórico de Bônus Binários
            </CardTitle>
            <CardDescription>
              Registro de todos os bônus recebidos por fechamento de ciclo
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Recebido</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(totalReceived)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {bonuses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Você ainda não recebeu nenhum bônus binário.</p>
            <p className="text-sm mt-1">
              Os bônus são gerados quando o admin fecha um ciclo e você tem pontos pareados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ArrowLeft className="w-3 h-3" />
                      Esq.
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      Dir.
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Pareados</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-right">Bônus</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonuses.map((bonus) => (
                  <TableRow key={bonus.id}>
                    <TableCell>
                      <Badge variant="outline">#{bonus.cycle_number || '?'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        {formatDate(bonus.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">
                        <span className="font-medium">{bonus.left_points_before}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="text-primary">{bonus.left_points_remaining}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm">
                        <span className="font-medium">{bonus.right_points_before}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="text-primary">{bonus.right_points_remaining}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{bonus.matched_points}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {bonus.bonus_percentage}%
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatPrice(bonus.bonus_value)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(bonus.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BinaryBonusHistory;
