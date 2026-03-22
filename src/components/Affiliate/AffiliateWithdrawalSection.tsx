import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Wallet, Banknote, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useAffiliateWithdrawals, AffiliatePixDetails } from '@/hooks/useAffiliateWithdrawals';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AffiliateWithdrawalSectionProps {
  affiliateId: string;
  commissionBalance: number;
  pixKey?: string | null;
  bankDetails?: { pix_key_type?: string; holder_name?: string } | null;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  approved: { label: 'Aprovado', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  paid: { label: 'Pago', variant: 'default', icon: <CheckCircle className="h-3 w-3" /> },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

const pixKeyTypeLabels: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  phone: 'Telefone',
  random: 'Chave Aleatória',
};

export function AffiliateWithdrawalSection({ affiliateId, commissionBalance, pixKey, bankDetails }: AffiliateWithdrawalSectionProps) {
  const {
    withdrawals,
    loading,
    submitting,
    minWithdrawal,
    requestWithdrawal,
    savePixDetails,
    hasPendingWithdrawal
  } = useAffiliateWithdrawals(affiliateId);

  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [pixForm, setPixForm] = useState<AffiliatePixDetails>({
    pix_key: pixKey || '',
    pix_key_type: (bankDetails?.pix_key_type as AffiliatePixDetails['pix_key_type']) || 'cpf',
    holder_name: bankDetails?.holder_name || ''
  });

  const hasPixConfigured = !!pixKey;

  const handleRequestWithdrawal = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return;

    if (!hasPixConfigured) {
      setWithdrawalDialogOpen(false);
      setPixDialogOpen(true);
      return;
    }

    const result = await requestWithdrawal(value, {
      pix_key: pixKey!,
      pix_key_type: (bankDetails?.pix_key_type as AffiliatePixDetails['pix_key_type']) || 'cpf',
      holder_name: bankDetails?.holder_name
    });

    if (result.success) {
      setWithdrawalDialogOpen(false);
      setAmount('');
    }
  };

  const handleSavePixDetails = async () => {
    if (!pixForm.pix_key) return;
    const result = await savePixDetails(pixForm);
    if (result.success) {
      setPixDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatPrice(commissionBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Mínimo para saque: {formatPrice(minWithdrawal)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dados PIX</CardTitle>
            <Banknote className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {hasPixConfigured ? (
              <>
                <p className="text-sm font-medium truncate">{pixKey}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pixKeyTypeLabels[bankDetails?.pix_key_type || ''] || 'PIX'}
                  {bankDetails?.holder_name && ` • ${bankDetails.holder_name}`}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma chave PIX cadastrada</p>
            )}
            <Button variant="link" className="p-0 h-auto mt-2 text-xs" onClick={() => setPixDialogOpen(true)}>
              {hasPixConfigured ? 'Editar dados' : 'Cadastrar PIX'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitar Saque</CardTitle>
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setWithdrawalDialogOpen(true)}
              disabled={commissionBalance < minWithdrawal || hasPendingWithdrawal}
              className="w-full"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Solicitar Saque
            </Button>
            {hasPendingWithdrawal && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Saque pendente em análise
              </p>
            )}
            {!hasPendingWithdrawal && commissionBalance < minWithdrawal && (
              <p className="text-xs text-muted-foreground mt-2">
                Saldo insuficiente para saque
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico de saques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Saques</CardTitle>
          <CardDescription>Acompanhe suas solicitações de saque</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum saque solicitado ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Chave PIX</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => {
                  const status = statusMap[w.status] || statusMap.pending;
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="text-sm">
                        {format(new Date(w.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{formatPrice(w.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {w.payment_details?.pix_key || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          {status.icon}
                          {status.label}
                        </Badge>
                        {w.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">{w.rejection_reason}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de solicitar saque */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p>Saldo disponível: <strong className="text-primary">{formatPrice(commissionBalance)}</strong></p>
              <p className="text-muted-foreground">Valor mínimo: {formatPrice(minWithdrawal)}</p>
            </div>

            <div className="space-y-2">
              <Label>Valor do saque (R$)</Label>
              <Input
                type="number"
                placeholder={`Mínimo ${minWithdrawal.toFixed(2)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={minWithdrawal}
                max={commissionBalance}
                step="0.01"
              />
            </div>

            {hasPixConfigured && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">Dados de pagamento:</p>
                <p className="text-muted-foreground">{pixKeyTypeLabels[bankDetails?.pix_key_type || ''] || 'PIX'}: {pixKey}</p>
                {bankDetails?.holder_name && <p className="text-muted-foreground">Titular: {bankDetails.holder_name}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleRequestWithdrawal}
              disabled={submitting || !amount || parseFloat(amount) < minWithdrawal || parseFloat(amount) > commissionBalance}
            >
              {submitting ? 'Enviando...' : 'Confirmar Saque'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de dados PIX */}
      <Dialog open={pixDialogOpen} onOpenChange={setPixDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados PIX</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de chave</Label>
              <Select
                value={pixForm.pix_key_type}
                onValueChange={(v) => setPixForm(prev => ({ ...prev, pix_key_type: v as AffiliatePixDetails['pix_key_type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="random">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input
                placeholder="Digite sua chave PIX"
                value={pixForm.pix_key}
                onChange={(e) => setPixForm(prev => ({ ...prev, pix_key: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome do titular</Label>
              <Input
                placeholder="Nome completo do titular"
                value={pixForm.holder_name || ''}
                onChange={(e) => setPixForm(prev => ({ ...prev, holder_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPixDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePixDetails} disabled={submitting || !pixForm.pix_key}>
              {submitting ? 'Salvando...' : 'Salvar Dados PIX'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
