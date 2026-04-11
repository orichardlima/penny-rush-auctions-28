import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Gift, GitBranch, Coins, ArrowDownCircle, Wallet, TrendingUp, Calendar, Info, UserCheck, Link2 } from 'lucide-react';
import { useCurrentWeekRevenue } from '@/hooks/useCurrentWeekRevenue';
import DailyRevenueBars from '@/components/Partner/DailyRevenueBars';

interface PartnerDetailModalProps {
  contract: any;
  open: boolean;
  onClose: () => void;
}

const PartnerDetailModal: React.FC<PartnerDetailModalProps> = ({ contract, open, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [referralBonuses, setReferralBonuses] = useState<any[]>([]);
  const [binaryBonuses, setBinaryBonuses] = useState<any[]>([]);
  const [manualCredits, setManualCredits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [sponsorInfo, setSponsorInfo] = useState<{ name: string; referralCode: string | null; date: string } | null>(null);

  // Hook for current week revenue (must be called unconditionally)
  const weekContract = useMemo(() => (
    contract ? {
      id: contract.id,
      aporte_value: contract.aporte_value,
      weekly_cap: contract.weekly_cap,
      user_id: contract.user_id,
      created_at: contract.created_at,
    } : null
  ), [contract?.id, contract?.aporte_value, contract?.weekly_cap, contract?.user_id, contract?.created_at]);
  const weekRevenue = useCurrentWeekRevenue(weekContract);

  useEffect(() => {
    if (!open || !contract?.id) return;

    const fetchData = async () => {
      setLoading(true);
      const [payoutsRes, referralRes, binaryRes, creditsRes, withdrawalsRes] = await Promise.all([
        supabase.from('partner_payouts').select('*').eq('partner_contract_id', contract.id).order('created_at', { ascending: false }),
        supabase.from('partner_referral_bonuses').select('*').eq('referrer_contract_id', contract.id).order('created_at', { ascending: false }),
        supabase.from('binary_bonuses').select('*').eq('partner_contract_id', contract.id).order('created_at', { ascending: false }),
        supabase.from('partner_manual_credits').select('*').eq('partner_contract_id', contract.id).order('created_at', { ascending: false }),
        supabase.from('partner_withdrawals').select('*').eq('partner_contract_id', contract.id).order('created_at', { ascending: false }),
      ]);

      setPayouts(payoutsRes.data || []);
      setReferralBonuses(referralRes.data || []);
      setBinaryBonuses(binaryRes.data || []);
      setManualCredits(creditsRes.data || []);
      setWithdrawals(withdrawalsRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, [open, contract?.id]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const formatDate = (dateString: string | null) =>
    dateString ? new Date(dateString).toLocaleDateString('pt-BR') : '-';

  const totalPayouts = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalReferral = referralBonuses.reduce((sum, b) => sum + Number(b.bonus_value), 0);
  const totalBinary = binaryBonuses.reduce((sum, b) => sum + Number(b.bonus_value), 0);
  const totalCredits = manualCredits.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      PAID: { className: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'Pago' },
      PENDING: { className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Pendente' },
      AVAILABLE: { className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'Disponível' },
      CANCELLED: { className: 'bg-gray-500/10 text-gray-600 border-gray-500/20', label: 'Cancelado' },
      REJECTED: { className: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'Rejeitado' },
      approved: { className: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'Aprovado' },
      paid: { className: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'Pago' },
      pending: { className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Pendente' },
      rejected: { className: 'bg-red-500/10 text-red-600 border-red-500/20', label: 'Rejeitado' },
    };
    const s = map[status] || { className: '', label: status };
    return <Badge className={s.className}>{s.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Detalhes do Parceiro: {contract?.user_name}
          </DialogTitle>
          <DialogDescription>
            Plano {contract?.plan_name} · Aporte {formatPrice(contract?.aporte_value)} · Ativado em {formatDate(contract?.created_at)} · Status: {contract?.status}
            {contract?.financial_status && contract.financial_status !== 'paid' && (
              <Badge className={`ml-2 ${contract.financial_status === 'pending_payment' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                {contract.financial_status === 'pending_payment' ? 'Pgto Pendente' : 'Inadimplente'}
              </Badge>
            )}
            {contract?.financial_status_note && (
              <span className="block text-xs text-muted-foreground mt-1">Obs: {contract.financial_status_note}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Repasses</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg font-bold text-green-600">{formatPrice(totalPayouts)}</div>
                  <p className="text-[10px] text-muted-foreground">{payouts.length} registros</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Bônus Indicação</CardTitle>
                  <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg font-bold text-blue-600">{formatPrice(totalReferral)}</div>
                  <p className="text-[10px] text-muted-foreground">{referralBonuses.length} registros</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Bônus Binário</CardTitle>
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg font-bold text-purple-600">{formatPrice(totalBinary)}</div>
                  <p className="text-[10px] text-muted-foreground">{binaryBonuses.length} registros</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Créditos Manuais</CardTitle>
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg font-bold text-orange-600">{formatPrice(totalCredits)}</div>
                  <p className="text-[10px] text-muted-foreground">{manualCredits.length} registros</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Saques</CardTitle>
                  <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg font-bold text-red-600">{formatPrice(totalWithdrawals)}</div>
                  <p className="text-[10px] text-muted-foreground">{withdrawals.length} registros</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-medium">Saldo Disponível</CardTitle>
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-lg font-bold">{formatPrice(contract?.available_balance || 0)}</div>
                  <p className="text-[10px] text-muted-foreground">
                    {formatPrice(contract?.total_received || 0)} / {formatPrice(contract?.total_cap || 0)} cap
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Current Week Revenue */}
            {contract?.status === 'ACTIVE' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">Rendimento da Semana Atual</CardTitle>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <span className="text-lg font-bold text-primary">{formatPrice(weekRevenue.totalPartnerShare)}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        ({weekRevenue.percentageOfAporte.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% do aporte)
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {weekRevenue.loading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    </div>
                  ) : (
                    <>
                      <DailyRevenueBars
                        days={weekRevenue.days}
                        closingHour={weekRevenue.closingHour}
                        isAnimating={weekRevenue.isAnimating}
                        formatPrice={formatPrice}
                      />
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {weekRevenue.eligibleDaysCount} dias elegíveis
                        </span>
                        {weekRevenue.hasProRata && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Info className="h-3 w-3" />
                            Pro Rata aplicado
                          </span>
                        )}
                        <span>Fecha às {weekRevenue.closingHour}h</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tabs with history */}
            <Tabs defaultValue="payouts" className="w-full">
              <TabsList className="w-full flex flex-wrap h-auto gap-1">
                <TabsTrigger value="payouts" className="text-xs">Repasses ({payouts.length})</TabsTrigger>
                <TabsTrigger value="referral" className="text-xs">Indicação ({referralBonuses.length})</TabsTrigger>
                <TabsTrigger value="binary" className="text-xs">Binário ({binaryBonuses.length})</TabsTrigger>
                <TabsTrigger value="credits" className="text-xs">Créditos ({manualCredits.length})</TabsTrigger>
                <TabsTrigger value="withdrawals" className="text-xs">Saques ({withdrawals.length})</TabsTrigger>
              </TabsList>

              {/* Payouts Tab */}
              <TabsContent value="payouts">
                <div className="max-h-64 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Período</TableHead>
                        <TableHead className="text-xs">Calculado</TableHead>
                        <TableHead className="text-xs">Valor Final</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Pago em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs">Nenhum repasse</TableCell></TableRow>
                      ) : payouts.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{formatDate(p.period_start)}</TableCell>
                          <TableCell className="text-xs">{formatPrice(p.calculated_amount)}</TableCell>
                          <TableCell className="text-xs font-medium">{formatPrice(p.amount)}</TableCell>
                          <TableCell>{getStatusBadge(p.status)}</TableCell>
                          <TableCell className="text-xs">{formatDate(p.paid_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Referral Bonuses Tab */}
              <TabsContent value="referral">
                <div className="max-h-64 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Nível</TableHead>
                        <TableHead className="text-xs">Aporte Ref.</TableHead>
                        <TableHead className="text-xs">%</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referralBonuses.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-xs">Nenhum bônus</TableCell></TableRow>
                      ) : referralBonuses.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs">Nível {b.referral_level}</TableCell>
                          <TableCell className="text-xs">{formatPrice(b.aporte_value)}</TableCell>
                          <TableCell className="text-xs">{b.bonus_percentage}%</TableCell>
                          <TableCell className="text-xs font-medium">{formatPrice(b.bonus_value)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {getStatusBadge(b.status)}
                              {b.status === 'PENDING' && b.available_at && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  (libera {formatDate(b.available_at)})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(b.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Binary Bonuses Tab */}
              <TabsContent value="binary">
                <div className="max-h-64 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Pontos Pareados</TableHead>
                        <TableHead className="text-xs">%</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {binaryBonuses.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs">Nenhum bônus binário</TableCell></TableRow>
                      ) : binaryBonuses.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs">{b.matched_points}</TableCell>
                          <TableCell className="text-xs">{b.bonus_percentage}%</TableCell>
                          <TableCell className="text-xs font-medium">{formatPrice(b.bonus_value)}</TableCell>
                          <TableCell>{getStatusBadge(b.status)}</TableCell>
                          <TableCell className="text-xs">{formatDate(b.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Manual Credits Tab */}
              <TabsContent value="credits">
                <div className="max-h-64 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Consome Cap</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manualCredits.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs">Nenhum crédito</TableCell></TableRow>
                      ) : manualCredits.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs capitalize">{c.credit_type}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{c.description}</TableCell>
                          <TableCell className="text-xs font-medium">{formatPrice(c.amount)}</TableCell>
                          <TableCell className="text-xs">{c.consumes_cap ? 'Sim' : 'Não'}</TableCell>
                          <TableCell className="text-xs">{formatDate(c.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Withdrawals Tab */}
              <TabsContent value="withdrawals">
                <div className="max-h-64 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Método</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Solicitado</TableHead>
                        <TableHead className="text-xs">Pago em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-xs">Nenhum saque</TableCell></TableRow>
                      ) : withdrawals.map(w => (
                        <TableRow key={w.id}>
                          <TableCell className="text-xs font-medium">{formatPrice(w.amount)}</TableCell>
                          <TableCell className="text-xs uppercase">{w.payment_method}</TableCell>
                          <TableCell>{getStatusBadge(w.status)}</TableCell>
                          <TableCell className="text-xs">{formatDate(w.requested_at)}</TableCell>
                          <TableCell className="text-xs">{formatDate(w.paid_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PartnerDetailModal;
