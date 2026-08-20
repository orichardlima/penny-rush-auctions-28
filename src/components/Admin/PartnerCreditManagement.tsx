import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HandCoins, Loader2, Plus, CheckCircle2 } from 'lucide-react';

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

interface CreditLineRow {
  id: string;
  user_id: string;
  limit_amount: number;
  used_amount: number;
  default_term_days: number;
  status: string;
  notes: string | null;
  valid_until: string | null;
  name?: string;
  email?: string;
}

interface DebtRow {
  id: string;
  user_id: string;
  referred_email: string | null;
  amount: number;
  paid_amount: number | null;
  term_days: number | null;
  due_date: string;
  status: string;
  created_at: string;
  name?: string;
}

const PartnerCreditManagement: React.FC = () => {
  const { toast } = useToast();
  const [lines, setLines] = useState<CreditLineRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [termDays, setTermDays] = useState('7');
  const [validUntil, setValidUntil] = useState('');

  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: lineRows }, { data: debtRows }] = await Promise.all([
      supabase.from('partner_credit_lines').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_credit_debts').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    const userIds = Array.from(new Set([
      ...(lineRows || []).map((l: any) => l.user_id),
      ...(debtRows || []).map((d: any) => d.user_id),
    ]));

    let profileMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => {
        profileMap[p.user_id] = { name: p.full_name || '—', email: p.email || '' };
      });
    }

    setLines(((lineRows || []) as any[]).map(l => ({
      ...l,
      name: profileMap[l.user_id]?.name,
      email: profileMap[l.user_id]?.email,
    })));
    setDebts(((debtRows || []) as any[]).map(d => ({
      ...d,
      name: profileMap[d.user_id]?.name,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveLine = async () => {
    const amount = parseFloat(limitAmount.replace(',', '.'));
    if (!email.trim() || isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Informe o e-mail e um limite válido' });
      return;
    }

    setSaving(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Usuário não encontrado com este e-mail');

      const { data, error } = await supabase.rpc('admin_set_credit_line', {
        _user_id: (profile as any).user_id,
        _limit_amount: amount,
        _default_term_days: parseInt(termDays) || 7,
        _notes: notes.trim() || undefined,
        _valid_until: validUntil || undefined,
        _clear_valid_until: !validUntil,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: '✅ Limite de crédito atualizado' });
      setDialogOpen(false);
      setEmail(''); setLimitAmount(''); setTermDays('7'); setNotes(''); setValidUntil('');
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSettle = async (debt: DebtRow, partial = false) => {
    const remaining = Math.max(0, Number(debt.amount) - Number(debt.paid_amount || 0));
    let amount: number | undefined;

    if (partial) {
      const input = prompt(`Valor recebido (saldo devedor ${formatPrice(remaining)}):`);
      if (!input) return;
      const parsed = parseFloat(input.replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0 || parsed > remaining + 0.009) {
        toast({ variant: 'destructive', title: 'Valor inválido' });
        return;
      }
      amount = parsed;
    } else if (!confirm(`Confirmar baixa total de ${formatPrice(remaining)}?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_settle_credit_debt', {
        _debt_id: debt.id,
        _notes: partial ? 'Baixa parcial manual pelo administrador' : 'Baixa manual pelo administrador',
        ...(amount ? { _amount: amount } : {}),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: partial ? '✅ Baixa parcial registrada' : '✅ Devolução quitada' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    }
  };


  const statusBadge = (status: string) => {
    if (status === 'PAID') return <Badge variant="secondary">Quitada</Badge>;
    if (status === 'OVERDUE') return <Badge variant="destructive">Vencida</Badge>;
    if (status === 'WRITTEN_OFF') return <Badge variant="outline">Baixada</Badge>;
    return <Badge>Em aberto</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Caixa de Crédito de Confiança
            </CardTitle>
            <CardDescription>
              Limites concedidos a líderes para ativar parceiros e devolver depois via PIX.
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Definir limite
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum limite concedido ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Líder</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Em uso</TableHead>
                  <TableHead>Disponível</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.email}</div>
                    </TableCell>
                    <TableCell>{formatPrice(l.limit_amount)}</TableCell>
                    <TableCell>{formatPrice(l.used_amount)}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatPrice(Number(l.limit_amount) - Number(l.used_amount))}
                    </TableCell>
                    <TableCell>{l.default_term_days}d</TableCell>
                    <TableCell>
                      <Badge variant={l.status === 'ACTIVE' ? 'default' : 'outline'}>{l.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devoluções</CardTitle>
          <CardDescription>Histórico de usos do crédito e suas devoluções.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {debts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Líder</TableHead>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-sm">{d.referred_email || '—'}</TableCell>
                    <TableCell>{formatPrice(d.amount)}</TableCell>
                    <TableCell>{new Date(d.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell>
                      {(d.status === 'OPEN' || d.status === 'OVERDUE') && (
                        <Button size="sm" variant="outline" onClick={() => handleSettle(d.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Dar baixa
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Definir limite de crédito</DialogTitle>
            <DialogDescription>
              Informe o e-mail do líder e o limite de confiança. Para revogar, defina o limite como 0.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>E-mail do líder</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lider@email.com" />
            </div>
            <div className="space-y-1">
              <Label>Limite (R$)</Label>
              <Input value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)} placeholder="1000.00" />
            </div>
            <div className="space-y-1">
              <Label>Prazo de devolução (dias)</Label>
              <Input type="number" value={termDays} onChange={(e) => setTermDays(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveLine} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerCreditManagement;
