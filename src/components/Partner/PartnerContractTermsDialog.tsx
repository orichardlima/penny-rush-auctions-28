import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, ExternalLink, Loader2 } from 'lucide-react';
import { PartnerPlan } from '@/hooks/usePartnerContract';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { registerContractAcceptance, PARTNER_DECLARATION_TEXT } from '@/utils/contractAcceptance';
import { toast } from 'sonner';

const FALLBACK_TEXT = `CONTRATO DE PARTICIPAÇÃO NO PROGRAMA DE PARCEIROS

CLÁUSULA 1 — OBJETO
O presente contrato regula a participação do PARCEIRO no Programa de Parceiros da plataforma Show de Lances, mediante aporte financeiro e participação nos repasses proporcionais ao faturamento da plataforma.

CLÁUSULA 2 — APORTE
O PARCEIRO realizará um aporte único correspondente ao plano selecionado, mediante pagamento via PIX.

CLÁUSULA 3 — REPASSES SEMANAIS
Os repasses serão realizados semanalmente, de forma proporcional ao faturamento real da plataforma no período de referência. O valor de cada repasse é variável e depende exclusivamente do desempenho comercial da plataforma, não havendo garantia de valor mínimo.

CLÁUSULA 4 — TETO DE RECEBIMENTO
O teto total de recebimentos acumulados do PARCEIRO é definido pelo plano contratado. Ao atingir esse valor, o contrato será automaticamente encerrado, não sendo devidos valores adicionais.

CLÁUSULA 5 — PRAZO
O contrato permanecerá vigente até que o teto de recebimento seja atingido ou até que uma das partes solicite o encerramento antecipado, conforme previsto neste instrumento.

CLÁUSULA 6 — ENCERRAMENTO ANTECIPADO
O PARCEIRO poderá solicitar o encerramento antecipado do contrato a qualquer momento. Nessa hipótese, o valor restante poderá ser devolvido na forma de créditos em lances na plataforma, com desconto proporcional ao tempo de participação, conforme política vigente.

CLÁUSULA 7 — BÔNUS DE LANCES
O plano poderá incluir bônus de lances para uso na plataforma, conforme especificado no plano contratado.

CLÁUSULA 8 — PROGRAMA DE INDICAÇÕES
O PARCEIRO poderá indicar novos participantes e receber bonificações adicionais conforme as regras do programa de indicações vigentes no momento da adesão. As bonificações de indicação são independentes dos repasses semanais.

CLÁUSULA 9 — RISCOS E ISENÇÕES
O PARCEIRO declara estar ciente de que:
• Os repasses são variáveis e dependem do faturamento real da plataforma.
• Não há garantia de retorno mínimo ou prazo definido para atingir o teto.
• O desempenho passado da plataforma não garante resultados futuros.
• A plataforma poderá suspender ou encerrar o programa em caso de força maior ou decisão administrativa, com comunicação prévia aos parceiros.

CLÁUSULA 10 — TROCA DE PATROCINADOR E SAÍDA DA REDE
O PARCEIRO poderá solicitar a saída da rede do seu patrocinador atual, sujeito às seguintes condições:
• A solicitação só poderá ser feita dentro do prazo de 30 (trinta) dias contados da data de cadastro do contrato. Após esse prazo, o vínculo com o patrocinador torna-se definitivo.
• Ao confirmar a saída, todos os bônus de indicação pendentes relacionados ao PARCEIRO serão automaticamente cancelados, e os bônus já disponíveis na conta do patrocinador anterior poderão ser revertidos, conforme a política vigente.
• Após a saída, o PARCEIRO terá o prazo de 7 (sete) dias para escolher um novo patrocinador. Caso não escolha dentro desse prazo, será automaticamente reintegrado à rede do patrocinador anterior.
• Após o uso da opção de saída, o PARCEIRO ficará sujeito a um período de carência de 90 (noventa) dias antes de poder solicitar nova troca de patrocinador.
• A troca de patrocinador não altera o valor do aporte, o teto de recebimento, nem o histórico de repasses já realizados.

CLÁUSULA 11 — PRIVACIDADE E DADOS
Os dados pessoais do PARCEIRO serão tratados conforme a Política de Privacidade da plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD).

CLÁUSULA 12 — DISPOSIÇÕES GERAIS
Ao aceitar este contrato, o PARCEIRO declara ter lido, compreendido e concordado com todas as cláusulas aqui descritas. A aceitação eletrônica possui validade jurídica nos termos da legislação brasileira vigente.`;

interface PartnerContractTermsDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
  plan: PartnerPlan;
  loading?: boolean;
  readOnly?: boolean;
  acceptedAt?: string | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);

export const PartnerContractTermsDialog: React.FC<PartnerContractTermsDialogProps> = ({
  open,
  onClose,
  onAccept,
  plan,
  loading = false,
  readOnly = false,
  acceptedAt = null,
}) => {
  const [accepted, setAccepted] = useState(false);
  const [registering, setRegistering] = useState(false);
  const { getSettingValue } = useSystemSettings();

  const contractText = getSettingValue('contract_partner_text', '') || FALLBACK_TEXT;

  const handleClose = () => {
    setAccepted(false);
    onClose();
  };

  const handleAccept = async () => {
    if (!accepted || !onAccept) return;
    setRegistering(true);
    try {
      const acceptanceId = await registerContractAcceptance({
        contract_type: 'partner',
        origin: 'partner_adhesion',
        declaration_text: PARTNER_DECLARATION_TEXT,
        plan_name: plan.display_name,
        plan_value: plan.aporte_value,
        extra: { plan_id: plan.id },
      });
      if (!acceptanceId) {
        toast.error('Não foi possível registrar o aceite eletrônico. Tente novamente.');
        setRegistering(false);
        return;
      }
      setAccepted(false);
      setRegistering(false);
      onAccept();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar aceite eletrônico.');
      setRegistering(false);
    }
  };

  const openContractInNewTab = () => {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    const safe = contractText.replace(/</g, '&lt;');
    w.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Contrato de Adesão ao Programa de Parceiros</title><style>body{font-family:system-ui,sans-serif;max-width:780px;margin:32px auto;padding:0 16px;line-height:1.6;color:#111}h1{font-size:20px}pre{white-space:pre-wrap;font-family:inherit;font-size:14px}</style></head><body><h1>Contrato de Adesão ao Programa de Parceiros</h1><pre>${safe}</pre></body></html>`);
    w.document.close();
  };

  const acceptedLabel = acceptedAt
    ? new Date(acceptedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contrato de Participação — Plano {plan.display_name}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? acceptedLabel
                ? `Contrato aceito em ${acceptedLabel}.`
                : 'Contrato aceito no momento da adesão.'
              : 'Leia atentamente o contrato abaixo antes de prosseguir.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-4 text-sm leading-relaxed text-foreground">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p><strong>Plano:</strong> {plan.display_name}</p>
              <p><strong>Aporte:</strong> {formatCurrency(plan.aporte_value)}</p>
              <p><strong>Teto semanal:</strong> {formatCurrency(plan.weekly_cap)}</p>
              <p><strong>Teto total:</strong> {formatCurrency(plan.total_cap)}</p>
              {plan.bonus_bids && plan.bonus_bids > 0 && (
                <p><strong>Bônus de lances:</strong> {plan.bonus_bids} lances</p>
              )}
            </div>
            <div className="whitespace-pre-wrap">{contractText}</div>
          </div>
        </ScrollArea>

        <div className="border-t pt-4 space-y-4">
          {readOnly ? (
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          ) : (
            <>
              <button
                type="button"
                onClick={openContractInNewTab}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Ler Contrato de Adesão ao Programa de Parceiros
              </button>

              <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-border bg-muted/30 p-3">
                <Checkbox
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-relaxed">{PARTNER_DECLARATION_TEXT}</span>
              </label>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose} disabled={loading || registering}>
                  Cancelar
                </Button>
                <Button onClick={handleAccept} disabled={!accepted || loading || registering}>
                  {(loading || registering) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {registering ? 'Registrando aceite...' : loading ? 'Processando...' : 'Aceitar e Continuar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
};
