import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, Wallet, Trophy, Gift, Clock, ArrowDownToLine } from 'lucide-react';

interface VaultWin {
  vault_instance_id: string;
  amount: number;
  type: 'top' | 'raffle';
  auction_title: string;
  distributed_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export const FuryVaultUserSection: React.FC = () => {
  const { user } = useAuth();
  const [wins, setWins] = useState<VaultWin[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch vault wins from logs
      const { data: logsData } = await supabase
        .from('fury_vault_logs')
        .select(`
          vault_instance_id,
          amount,
          event_type,
          details,
          created_at
        `)
        .in('event_type', ['distribution_top', 'distribution_raffle'])
        .order('created_at', { ascending: false });

      // Filter logs for current user (details contains user_id)
      const userWins: VaultWin[] = [];
      let totalWon = 0;

      if (logsData) {
        for (const log of logsData) {
          const details = log.details as any;
          if (details?.user_id === user.id) {
            totalWon += log.amount;
            userWins.push({
              vault_instance_id: log.vault_instance_id,
              amount: log.amount,
              type: log.event_type === 'distribution_top' ? 'top' : 'raffle',
              auction_title: details?.auction_title || 'Leilão',
              distributed_at: log.created_at,
            });
          }
        }
      }

      setWins(userWins);
      setTotalWinnings(totalWon);

      // Fetch withdrawals
      const { data: withdrawalsData } = await supabase
        .from('fury_vault_withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setWithdrawals(withdrawalsData || []);
      const withdrawn = (withdrawalsData || [])
        .filter(w => w.status !== 'rejected')
        .reduce((sum, w) => sum + w.amount, 0);
      setTotalWithdrawn(withdrawn);
    } catch (error) {
      console.error('Error fetching vault data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user?.id) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Erro', description: 'Informe um valor válido.', variant: 'destructive' });
      return;
    }

    const available = totalWinnings - totalWithdrawn;
    if (amount > available) {
      toast({ title: 'Erro', description: 'Valor excede o saldo disponível.', variant: 'destructive' });
      return;
    }

    setWithdrawing(true);
    try {
      // We need a source vault - use the most recent completed vault the user won from
      const recentWin = wins[0];
      if (!recentWin) {
        toast({ title: 'Erro', description: 'Nenhum prêmio encontrado para saque.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('fury_vault_withdrawals')
        .insert({
          user_id: user.id,
          amount,
          source_vault_id: recentWin.vault_instance_id,
          status: 'pending',
        });

      if (error) throw error;

      toast({ title: 'Solicitação enviada!', description: `Saque de R$ ${amount.toFixed(2)} solicitado com sucesso.` });
      setWithdrawAmount('');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast({ title: 'Erro', description: 'Erro ao solicitar saque.', variant: 'destructive' });
    } finally {
      setWithdrawing(false);
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const statusLabel: Record<string, { text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    pending: { text: 'Pendente', variant: 'secondary' },
    processing: { text: 'Processando', variant: 'outline' },
    completed: { text: 'Pago', variant: 'default' },
    rejected: { text: 'Rejeitado', variant: 'destructive' },
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Carregando dados do Cofre Fúria...
        </CardContent>
      </Card>
    );
  }

  const availableBalance = totalWinnings - totalWithdrawn;

  // Don't show section if user has never won anything
  if (wins.length === 0 && withdrawals.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold">Cofre Fúria - Meus Prêmios</h3>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ganho</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatPrice(totalWinnings)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(availableBalance)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sacado</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{formatPrice(totalWithdrawn)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw button */}
      {availableBalance > 0 && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Wallet className="h-4 w-4 mr-2" />
              Solicitar Saque
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Saque do Cofre Fúria</DialogTitle>
              <DialogDescription>
                Saldo disponível: {formatPrice(availableBalance)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor do saque (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <Button onClick={handleWithdraw} disabled={withdrawing} className="w-full">
                {withdrawing ? 'Processando...' : 'Confirmar Saque'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Win history */}
      {wins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Histórico de Prêmios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wins.map((win, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{formatDate(win.distributed_at)}</TableCell>
                    <TableCell>
                      <Badge variant={win.type === 'top' ? 'default' : 'secondary'}>
                        {win.type === 'top' ? '🏆 Top' : '🎲 Sorteio'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPrice(win.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal history */}
      {withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Histórico de Saques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => {
                  const st = statusLabel[w.status] || { text: w.status, variant: 'outline' as const };
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="text-sm">{formatDate(w.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.text}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatPrice(w.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
