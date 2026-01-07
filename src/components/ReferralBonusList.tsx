import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useReferralBonuses } from '@/hooks/useReferralBonuses';
import { 
  Gift, 
  Clock, 
  CheckCircle, 
  XCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react';

const ReferralBonusList = () => {
  const { bonuses, stats, loading, getStatusLabel, getStatusColor } = useReferralBonuses();

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Bônus</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">indicações com bônus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">em bônus gerados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponível</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPrice(stats.availableValue)}</div>
            <p className="text-xs text-muted-foreground">{stats.available} bônus disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Validação</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">aguardando liberação</p>
          </CardContent>
        </Card>
      </div>

      {/* Bonus List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Histórico de Bônus de Indicação
          </CardTitle>
          <CardDescription>
            Seus bônus por indicar amigos que compraram pacotes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bonuses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Valor da Compra</TableHead>
                  <TableHead>Bônus (10%)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Liberação</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonuses.map((bonus) => (
                  <TableRow key={bonus.id}>
                    <TableCell className="font-medium">{bonus.referred_user_name}</TableCell>
                    <TableCell>{formatPrice(bonus.package_value)}</TableCell>
                    <TableCell className="font-medium text-green-600">{formatPrice(bonus.bonus_value)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(bonus.status)}>
                        {getStatusLabel(bonus.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {bonus.available_at ? formatDate(bonus.available_at) : '-'}
                    </TableCell>
                    <TableCell>{formatDate(bonus.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Nenhum bônus ainda</h3>
              <p className="text-sm max-w-md mx-auto">
                Compartilhe seu link de indicação com amigos! Quando eles comprarem pacotes de lances,
                você ganha 10% do valor como bônus.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralBonusList;
