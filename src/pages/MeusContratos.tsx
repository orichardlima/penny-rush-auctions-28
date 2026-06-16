import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMeusContratos, PartnerContractRow } from '@/hooks/useMeusContratos';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Eye } from 'lucide-react';
import { BettorContractTermsDialog } from '@/components/BettorContractTermsDialog';
import { PartnerContractTermsDialog } from '@/components/Partner/PartnerContractTermsDialog';
import type { PartnerPlan } from '@/hooks/usePartnerContract';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    ACTIVE: { label: 'Ativo', variant: 'default' },
    CLOSED: { label: 'Encerrado', variant: 'secondary' },
    PENDING: { label: 'Pendente', variant: 'outline' },
    DELINQUENT: { label: 'Inadimplente', variant: 'destructive' },
  };
  const cfg = map[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

const contractToPlan = (c: PartnerContractRow): PartnerPlan =>
  ({
    id: c.id,
    name: c.plan_name,
    display_name: c.plan_name,
    aporte_value: c.aporte_value,
    weekly_cap: c.weekly_cap,
    total_cap: c.total_cap,
    bonus_bids: c.bonus_bids_received ?? 0,
    is_active: c.status === 'ACTIVE',
  } as PartnerPlan);

const MeusContratos: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { bettor, partnerContracts, loading } = useMeusContratos();
  const [bettorOpen, setBettorOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<PartnerContractRow | null>(null);

  if (!authLoading && !user) return <Navigate to="/auth?redirect=/meus-contratos" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex flex-col">
      <SEOHead
        title="Meus Contratos"
        description="Revise os contratos que você aceitou na plataforma Show de Lances."
      />
      <Header userBids={profile?.bids_balance || 0} onBuyBids={() => {}} />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 overflow-x-hidden">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" />
              Meus Contratos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Aqui você pode revisar a qualquer momento os termos que aceitou.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contrato do Apostador */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg break-words">Contrato do Apostador</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Termos e condições de uso da plataforma.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Assinado</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Assinado em{' '}
                    <span className="font-semibold text-foreground">
                      {formatDate(bettor?.accepted_at || bettor?.fallback_date || null)}
                    </span>
                    {bettor?.version && (
                      <span className="ml-2 text-xs">(versão {bettor.version})</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setBettorOpen(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver contrato
                  </Button>
                </CardContent>
              </Card>

              {/* Contratos de Parceiro */}
              {partnerContracts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Você ainda não possui contratos de Parceiro.
                  </CardContent>
                </Card>
              ) : (
                partnerContracts.map((c) => (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base sm:text-lg break-words">
                            Contrato de Parceiro — Plano {c.plan_name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            Aporte: {formatCurrency(c.aporte_value)} · Cotas: {c.cotas} · Teto total:{' '}
                            {formatCurrency(c.total_cap)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Assinado</Badge>
                          {statusBadge(c.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <div>
                          Assinado em{' '}
                          <span className="font-semibold text-foreground">{formatDate(c.created_at)}</span>
                        </div>
                        {c.closed_at && (
                          <div className="text-xs">
                            Encerrado em <span className="font-medium">{formatDate(c.closed_at)}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setSelectedPartner(c)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver contrato
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <BettorContractTermsDialog
        open={bettorOpen}
        onClose={() => setBettorOpen(false)}
        readOnly
        acceptedAt={bettor?.accepted_at || bettor?.fallback_date || null}
      />

      {selectedPartner && (
        <PartnerContractTermsDialog
          open={!!selectedPartner}
          onClose={() => setSelectedPartner(null)}
          plan={contractToPlan(selectedPartner)}
          readOnly
          acceptedAt={selectedPartner.created_at}
        />
      )}
    </div>
  );
};

export default MeusContratos;
