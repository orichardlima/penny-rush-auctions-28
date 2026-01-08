import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePartnerWithdrawals, PaymentDetails } from '@/hooks/usePartnerWithdrawals';
import { PartnerContract } from '@/hooks/usePartnerContract';
import PartnerPaymentDetailsForm from './PartnerPaymentDetailsForm';
import { 
  Wallet, 
  ArrowUpRight, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  CreditCard
} from 'lucide-react';

interface PartnerWithdrawalSectionProps {
  contract: PartnerContract & {
    pix_key?: string | null;
    pix_key_type?: string | null;
    bank_details?: any;
  };
  onRefresh?: () => void;
}

const PartnerWithdrawalSection: React.FC<PartnerWithdrawalSectionProps> = ({ contract, onRefresh }) => {
  const {
    withdrawals,
    loading,
    submitting,
    requestWithdrawal,
    updateContractPaymentDetails,
    calculateAvailableBalance,
    hasPendingWithdrawal
  } = usePartnerWithdrawals(contract.id);

  const [availableBalance, setAvailableBalance] = useState(0);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      const balance = await calculateAvailableBalance();
      setAvailableBalance(balance);
    };
    loadBalance();
  }, [calculateAvailableBalance, withdrawals]);

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Aguardando Pagamento</Badge>;
      case 'PAID':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case 'REJECTED':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const hasPaymentDetails = !!contract.pix_key;

  const handleRequestWithdrawal = async () => {
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (!hasPaymentDetails) {
      setIsWithdrawDialogOpen(false);
      setIsPaymentDialogOpen(true);
      return;
    }

    const paymentDetails: PaymentDetails = {
      pix_key: contract.pix_key!,
      pix_key_type: (contract.pix_key_type as PaymentDetails['pix_key_type']) || 'cpf',
      holder_name: contract.bank_details?.holder_name
    };

    const result = await requestWithdrawal(amount, paymentDetails);
    if (result.success) {
      setWithdrawalAmount('');
      setIsWithdrawDialogOpen(false);
      onRefresh?.();
    }
  };

  const handleSavePaymentDetails = async (data: PaymentDetails) => {
    const result = await updateContractPaymentDetails(data);
    if (result.success) {
      setIsPaymentDialogOpen(false);
      onRefresh?.();
    }
    return result;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saldo e Ações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo Disponível para Saque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatPrice(availableBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Baseado nos repasses pagos menos saques realizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Dados de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPaymentDetails ? (
              <div className="space-y-1">
                <p className="font-medium">PIX: {contract.pix_key}</p>
                <p className="text-xs text-muted-foreground capitalize">Tipo: {contract.pix_key_type}</p>
                <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setIsPaymentDialogOpen(true)}>
                  Alterar dados
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Nenhum dado cadastrado</p>
                <Button variant="outline" size="sm" onClick={() => setIsPaymentDialogOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Cadastrar PIX
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Botão de Solicitar Saque */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Solicitar Saque</h4>
              <p className="text-sm text-muted-foreground">
                {hasPendingWithdrawal 
                  ? 'Você já possui uma solicitação aguardando pagamento'
                  : availableBalance > 0 
                    ? 'Solicite a transferência do seu saldo disponível'
                    : 'Sem saldo disponível para saque'
                }
              </p>
            </div>
            
            <Dialog open={isWithdrawDialogOpen} onOpenChange={setIsWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  disabled={availableBalance <= 0 || hasPendingWithdrawal || contract.status !== 'ACTIVE'}
                >
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Solicitar Saque
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Solicitar Saque</DialogTitle>
                  <DialogDescription>
                    Informe o valor que deseja sacar. Saldo disponível: {formatPrice(availableBalance)}
                  </DialogDescription>
                </DialogHeader>

                {!hasPaymentDetails && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você precisa cadastrar seus dados de pagamento (PIX) antes de solicitar um saque.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor do Saque</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={availableBalance}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>

                  {hasPaymentDetails && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                      <p className="font-medium">Dados de recebimento:</p>
                      <p>PIX: {contract.pix_key}</p>
                      <p className="text-muted-foreground capitalize">Tipo: {contract.pix_key_type}</p>
                    </div>
                  )}

                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0"
                    onClick={() => setWithdrawalAmount(availableBalance.toFixed(2))}
                  >
                    Usar saldo total
                  </Button>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsWithdrawDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleRequestWithdrawal}
                    disabled={submitting || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0 || parseFloat(withdrawalAmount) > availableBalance}
                  >
                    {submitting ? 'Enviando...' : hasPaymentDetails ? 'Confirmar Saque' : 'Cadastrar PIX'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Saques */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Saques</CardTitle>
          <CardDescription>Todas as suas solicitações de saque</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="text-sm">{formatDate(withdrawal.requested_at)}</TableCell>
                    <TableCell className="font-medium">{formatPrice(withdrawal.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {withdrawal.payment_details?.pix_key || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                    <TableCell className="text-sm">
                      {withdrawal.status === 'PAID' && withdrawal.paid_at && (
                        <span className="text-green-600">Pago em {formatDate(withdrawal.paid_at)}</span>
                      )}
                      {withdrawal.status === 'REJECTED' && withdrawal.rejection_reason && (
                        <span className="text-red-600">{withdrawal.rejection_reason}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum saque solicitado</p>
              <p className="text-sm">Solicite seu primeiro saque quando tiver saldo disponível</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Dados de Pagamento */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados de Pagamento</DialogTitle>
            <DialogDescription>
              Configure sua chave PIX para receber os saques
            </DialogDescription>
          </DialogHeader>
          <PartnerPaymentDetailsForm
            initialData={{
              pix_key: contract.pix_key || undefined,
              pix_key_type: (contract.pix_key_type as PaymentDetails['pix_key_type']) || undefined,
              holder_name: contract.bank_details?.holder_name
            }}
            onSave={handleSavePaymentDetails}
            loading={submitting}
            compact
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerWithdrawalSection;
