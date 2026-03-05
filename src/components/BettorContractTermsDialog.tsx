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
import { FileText } from 'lucide-react';
import { useSystemSettings } from '@/hooks/useSystemSettings';

// Fallback text used when no database value exists
const FALLBACK_TEXT = `TERMOS E CONDIÇÕES DE USO — APOSTADOR

CLÁUSULA 1 — OBJETO
O presente termo regula a participação do APOSTADOR na plataforma Show de Lances, um sistema de leilões de centavos (penny auctions) onde os participantes adquirem lances para competir em leilões de produtos e serviços.

CLÁUSULA 2 — FUNCIONAMENTO DOS LEILÕES
Os leilões da plataforma funcionam no modelo de leilão de centavos. Cada lance dado por um participante incrementa o preço do produto em um valor pré-determinado e reinicia o cronômetro regressivo do leilão. O último participante a dar um lance quando o cronômetro atingir zero será o vencedor.
• Cada lance possui um custo fixo, definido no momento da compra do pacote de lances.
• O cronômetro é reiniciado a cada novo lance válido.
• O vencedor poderá adquirir o produto pelo preço final do leilão.

CLÁUSULA 3 — AQUISIÇÃO DE LANCES
Os lances são adquiridos através de pacotes disponibilizados na plataforma, com preços e quantidades variáveis. Os lances adquiridos não possuem prazo de validade e podem ser utilizados em qualquer leilão disponível na plataforma.

CLÁUSULA 4 — POLÍTICA DE REEMBOLSO
Os lances adquiridos são considerados créditos de participação e não são reembolsáveis após a confirmação do pagamento, exceto nos casos previstos pelo Código de Defesa do Consumidor (direito de arrependimento em até 7 dias da compra, caso os lances não tenham sido utilizados).

CLÁUSULA 5 — RESPONSABILIDADES DO APOSTADOR
O APOSTADOR declara e se compromete a:
• Fornecer dados pessoais verdadeiros e atualizados no momento do cadastro.
• Manter a confidencialidade de suas credenciais de acesso.
• Não utilizar dispositivos, scripts ou qualquer meio automatizado para dar lances.
• Não criar múltiplas contas para obter vantagem indevida nos leilões.
• Participar de forma leal e em conformidade com as regras da plataforma.

CLÁUSULA 6 — RISCOS E ISENÇÕES
O APOSTADOR declara estar ciente de que:
• A participação nos leilões não garante a aquisição de produtos. O resultado depende da dinâmica competitiva de cada leilão.
• Os lances utilizados em leilões dos quais o apostador não saiu vencedor não serão restituídos.
• A plataforma poderá cancelar ou suspender leilões por motivos técnicos, operacionais ou de força maior, com o devido reembolso dos lances utilizados no leilão cancelado.
• Problemas de conexão à internet ou falhas no dispositivo do apostador não constituem motivo para reembolso.

CLÁUSULA 7 — ENTREGA DOS PRODUTOS
Os produtos arrematados serão entregues no endereço cadastrado pelo vencedor, em prazo informado na plataforma após a confirmação do pagamento do valor final do leilão. A responsabilidade pela entrega é da plataforma e/ou de seus parceiros logísticos.

CLÁUSULA 8 — SUSPENSÃO E BANIMENTO
A plataforma reserva-se o direito de suspender ou banir permanentemente contas de apostadores que violem os termos de uso, incluindo, mas não se limitando a:
• Uso de bots ou automação para dar lances.
• Criação de múltiplas contas (multi-accounting).
• Fraude ou tentativa de fraude no sistema de pagamentos.
• Comportamento abusivo ou que prejudique outros participantes.

CLÁUSULA 9 — PRIVACIDADE E DADOS
Os dados pessoais do APOSTADOR serão tratados conforme a Política de Privacidade da plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).

CLÁUSULA 10 — DISPOSIÇÕES GERAIS
Ao aceitar este contrato, o APOSTADOR declara ter lido, compreendido e concordado com todas as cláusulas aqui descritas. A aceitação eletrônica possui validade jurídica nos termos da legislação brasileira vigente.
A plataforma reserva-se o direito de atualizar estes termos a qualquer momento, notificando os usuários sobre alterações significativas.

CLÁUSULA 11 — BÔNUS DE BOAS-VINDAS
Ao se cadastrar na plataforma, o usuário poderá receber lances gratuitos como bônus de boas-vindas. Esses lances têm finalidade exclusivamente experimental, permitindo ao usuário conhecer e testar o funcionamento dos leilões da plataforma.
Os lances de bônus de boas-vindas NÃO possuem validade para arrematação de produtos. Apenas lances adquiridos mediante pagamento são válidos para fins de arrematação.
Caso um usuário arremate um produto utilizando exclusivamente lances de bônus (sem ter adquirido lances pagos), a arrematação será considerada nula e sem efeito, não gerando obrigação de entrega por parte da plataforma.`;

interface BettorContractTermsDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  loading?: boolean;
}

export const BettorContractTermsDialog: React.FC<BettorContractTermsDialogProps> = ({
  open,
  onClose,
  onAccept,
  loading = false,
}) => {
  const [accepted, setAccepted] = useState(false);
  const { getSettingValue } = useSystemSettings();

  const contractText = getSettingValue('contract_bettor_text', '') || FALLBACK_TEXT;

  const handleClose = () => {
    setAccepted(false);
    onClose();
  };

  const handleAccept = () => {
    if (!accepted) return;
    setAccepted(false);
    onAccept();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contrato do Apostador — Show de Lances
          </DialogTitle>
          <DialogDescription>
            Leia atentamente os termos abaixo antes de prosseguir com o cadastro.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {contractText}
          </div>
        </ScrollArea>

        <div className="border-t pt-4 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Li e aceito integralmente os termos e condições de uso da plataforma Show de Lances.
            </span>
          </label>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleAccept} disabled={!accepted || loading}>
              {loading ? 'Processando...' : 'Aceitar e Cadastrar'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
