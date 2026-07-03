import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePartnerEarlyTermination } from '@/hooks/usePartnerEarlyTermination';
import type { PartnerContract } from '@/hooks/usePartnerContract';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  XCircle,
  AlertTriangle,
  CreditCard,
  Coins,
  DollarSign,
  Clock,
  FileSignature,
  ShieldCheck,
} from 'lucide-react';

interface PartnerEarlyTerminationDialogProps {
  contract: PartnerContract;
  onSuccess?: () => void;
}

type LiquidationType = 'CREDITS' | 'BIDS' | 'PARTIAL_REFUND';

type QuoteResponse = {
  settlement_quote_id: string;
  gross_amount: number;
  discounts: number;
  penalty: number;
  net_amount: number;
  terms_text: string;
  terms_hash: string;
  terms_version: string;
  expires_at: string;
};

const PartnerEarlyTerminationDialog = ({ contract, onSuccess }: PartnerEarlyTerminationDialogProps) => {
  const {
    pendingRequest,
    submitting,
    calculateLiquidationProposal,
    cancelRequest,
    getStatusLabel,
    getLiquidationTypeLabel,
  } = usePartnerEarlyTermination();

  const [liquidationType, setLiquidationType] = useState<LiquidationType>('CREDITS');
  const [isOpen, setIsOpen] = useState(false);

  // Fluxo em 2 etapas para assinatura eletrônica
  const [step, setStep] = useState<'select' | 'sign'>('select');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const proposal = calculateLiquidationProposal(contract);

  const formatPrice = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const resetToSelect = () => {
    setStep('select');
    setQuote(null);
    setAgreed(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetToSelect();
  };

  // Etapa 1 → 2: pede o termo ao servidor (recalcula, gera hash e quote)
  const handlePrepare = async () => {
    try {
      setPreparing(true);
      const { data, error } = await supabase.functions.invoke('prepare-partner-settlement', {
        body: { partner_contract_id: contract.id, liquidation_type: liquidationType },
      });
      if (error) throw error;
      if (!data?.settlement_quote_id) throw new Error('Falha ao gerar cotação');
      setQuote(data as QuoteResponse);
      setStep('sign');
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível gerar o termo de encerramento');
    } finally {
      setPreparing(false);
    }
  };

  // Etapa 3: consumo atômico do quote e registro do aceite com IP/UA server-side
  const handleSign = async () => {
    if (!quote) return;
    try {
      setSigning(true);
      const { data, error } = await supabase.functions.invoke('sign-partner-settlement', {
        body: {
          settlement_quote_id: quote.settlement_quote_id,
          route: typeof window !== 'undefined' ? window.location.pathname : null,
        },
      });
      if (error) throw error;
      if (!data?.acceptance_id) throw new Error('Assinatura não confirmada');

      if (data.processing_status === 'TERMINATION_FAILED') {
        toast.warning(
          'Assinatura registrada, encerramento pendente de processamento pela equipe.',
        );
      } else {
        toast.success('Assinatura eletrônica registrada com sucesso.');
      }

      setIsOpen(false);
      resetToSelect();
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao registrar assinatura');
    } finally {
      setSigning(false);
    }
  };

  const handleCancelRequest = async () => {
    if (pendingRequest) await cancelRequest(pendingRequest.id);
  };

  if (pendingRequest) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-500/5 border-yellow-500/20">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-700">Solicitação de Encerramento Pendente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sua solicitação de encerramento está sendo analisada.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p><strong>Tipo:</strong> {getLiquidationTypeLabel(pendingRequest.liquidation_type)}</p>
              <p><strong>Valor proposto:</strong> {formatPrice(pendingRequest.proposed_value)}</p>
              <p><strong>Status:</strong> <Badge variant="outline">{getStatusLabel(pendingRequest.status)}</Badge></p>
            </div>
            {pendingRequest.status === 'PENDING' && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleCancelRequest}
                disabled={submitting}
              >
                Cancelar Solicitação
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-orange-600 border-orange-500/30 hover:bg-orange-500/10">
          <XCircle className="h-4 w-4 mr-2" />
          Solicitar Encerramento Antecipado
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl">
        {step === 'select' && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Encerramento Antecipado
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 mt-4">
                  <Alert className="border-yellow-500/20 bg-yellow-500/5">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-700">
                      O encerramento antecipado é uma <strong>liquidação condicionada</strong>, sujeita
                      à liquidez da plataforma. <strong>Não representa devolução garantida do aporte</strong>.
                    </AlertDescription>
                  </Alert>

                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Proposta de liquidação (estimativa):</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Valor aportado:</span>
                      <span>{formatPrice(contract.aporte_value)}</span>
                      <span className="text-muted-foreground">Deságio sobre o aporte:</span>
                      <span className="text-orange-600">{proposal.discountPercentage}%</span>
                      <span className="text-muted-foreground">Já recebido em payouts:</span>
                      <span>− {formatPrice(contract.total_received)}</span>
                      <span className="text-muted-foreground">Valor proposto:</span>
                      <span className="font-medium text-green-600">{formatPrice(proposal.proposedValue)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">
                      Os valores definitivos serão recalculados pelo servidor no termo abaixo.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Escolha a forma de liquidação:</Label>
                    <RadioGroup
                      value={liquidationType}
                      onValueChange={(v) => setLiquidationType(v as LiquidationType)}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                        <RadioGroupItem value="CREDITS" id="credits" />
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <Label htmlFor="credits" className="cursor-pointer flex-1">
                          <span className="font-medium">Créditos na plataforma</span>
                          <p className="text-xs text-muted-foreground">{formatPrice(proposal.creditsEquivalent)} em créditos</p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                        <RadioGroupItem value="BIDS" id="bids" />
                        <Coins className="h-4 w-4 text-purple-600" />
                        <Label htmlFor="bids" className="cursor-pointer flex-1">
                          <span className="font-medium">Conversão em lances</span>
                          <p className="text-xs text-muted-foreground">{proposal.bidsEquivalent} lances</p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                        <RadioGroupItem value="PARTIAL_REFUND" id="refund" />
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <Label htmlFor="refund" className="cursor-pointer flex-1">
                          <span className="font-medium">Reembolso parcial (PIX)</span>
                          <p className="text-xs text-muted-foreground">Sujeito à aprovação e liquidez</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={preparing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePrepare}
                disabled={preparing}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {preparing ? 'Gerando termo…' : 'Prosseguir para assinatura'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}

        {step === 'sign' && quote && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-primary" />
                Assinatura eletrônica do termo
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted/40 p-3 rounded-md">
                    <span className="text-muted-foreground">Versão do contrato:</span>
                    <span className="font-mono">{quote.terms_version}</span>
                    <span className="text-muted-foreground">Hash do termo:</span>
                    <span className="font-mono text-xs break-all">{quote.terms_hash.slice(0, 24)}…</span>
                    <span className="text-muted-foreground">Valor líquido:</span>
                    <span className="font-semibold text-green-600">{formatPrice(quote.net_amount)}</span>
                    <span className="text-muted-foreground">Cotação expira em:</span>
                    <span>{new Date(quote.expires_at).toLocaleTimeString('pt-BR')}</span>
                  </div>

                  <ScrollArea className="h-72 border rounded-md p-3 bg-background">
                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
                      {quote.terms_text}
                    </pre>
                  </ScrollArea>

                  <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                    <Checkbox
                      id="agree-terms"
                      checked={agreed}
                      onCheckedChange={(v) => setAgreed(v === true)}
                    />
                    <Label htmlFor="agree-terms" className="text-sm cursor-pointer leading-snug">
                      Li e concordo com os valores, descontos, multa e modalidade de liquidação
                      descritos acima. Autorizo o registro eletrônico deste aceite, incluindo IP,
                      user agent e demais evidências técnicas da sessão.
                    </Label>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Assinatura protegida contra duplo clique — consumo atômico da cotação server-side.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={resetToSelect} disabled={signing}>
                Voltar
              </Button>
              <Button
                onClick={handleSign}
                disabled={!agreed || signing}
                className="bg-primary"
              >
                {signing ? 'Registrando assinatura…' : 'Assinar eletronicamente'}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PartnerEarlyTerminationDialog;
