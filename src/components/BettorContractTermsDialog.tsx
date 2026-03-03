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
          <div className="space-y-4 text-sm leading-relaxed text-foreground">
            <h3 className="font-semibold text-base">TERMOS E CONDIÇÕES DE USO — APOSTADOR</h3>

            <section>
              <h4 className="font-semibold">CLÁUSULA 1 — OBJETO</h4>
              <p>
                O presente termo regula a participação do APOSTADOR na plataforma Show de Lances,
                um sistema de leilões de centavos (penny auctions) onde os participantes adquirem
                lances para competir em leilões de produtos e serviços.
              </p>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 2 — FUNCIONAMENTO DOS LEILÕES</h4>
              <p>
                Os leilões da plataforma funcionam no modelo de leilão de centavos. Cada lance dado
                por um participante incrementa o preço do produto em um valor pré-determinado e
                reinicia o cronômetro regressivo do leilão. O último participante a dar um lance
                quando o cronômetro atingir zero será o vencedor.
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Cada lance possui um custo fixo, definido no momento da compra do pacote de lances.</li>
                <li>O cronômetro é reiniciado a cada novo lance válido.</li>
                <li>O vencedor poderá adquirir o produto pelo preço final do leilão.</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 3 — AQUISIÇÃO DE LANCES</h4>
              <p>
                Os lances são adquiridos através de pacotes disponibilizados na plataforma, com
                preços e quantidades variáveis. Os lances adquiridos não possuem prazo de validade e
                podem ser utilizados em qualquer leilão disponível na plataforma.
              </p>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 4 — POLÍTICA DE REEMBOLSO</h4>
              <p>
                Os lances adquiridos são considerados créditos de participação e{' '}
                <strong>não são reembolsáveis</strong> após a confirmação do pagamento, exceto nos
                casos previstos pelo Código de Defesa do Consumidor (direito de arrependimento em
                até 7 dias da compra, caso os lances não tenham sido utilizados).
              </p>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 5 — RESPONSABILIDADES DO APOSTADOR</h4>
              <p>O APOSTADOR declara e se compromete a:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Fornecer dados pessoais verdadeiros e atualizados no momento do cadastro.</li>
                <li>Manter a confidencialidade de suas credenciais de acesso.</li>
                <li>Não utilizar dispositivos, scripts ou qualquer meio automatizado para dar lances.</li>
                <li>Não criar múltiplas contas para obter vantagem indevida nos leilões.</li>
                <li>Participar de forma leal e em conformidade com as regras da plataforma.</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 6 — RISCOS E ISENÇÕES</h4>
              <p>O APOSTADOR declara estar ciente de que:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>
                  A participação nos leilões não garante a aquisição de produtos. O resultado
                  depende da dinâmica competitiva de cada leilão.
                </li>
                <li>
                  Os lances utilizados em leilões dos quais o apostador não saiu vencedor não
                  serão restituídos.
                </li>
                <li>
                  A plataforma poderá cancelar ou suspender leilões por motivos técnicos,
                  operacionais ou de força maior, com o devido reembolso dos lances utilizados
                  no leilão cancelado.
                </li>
                <li>
                  Problemas de conexão à internet ou falhas no dispositivo do apostador não
                  constituem motivo para reembolso.
                </li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 7 — ENTREGA DOS PRODUTOS</h4>
              <p>
                Os produtos arrematados serão entregues no endereço cadastrado pelo vencedor, em
                prazo informado na plataforma após a confirmação do pagamento do valor final do
                leilão. A responsabilidade pela entrega é da plataforma e/ou de seus parceiros
                logísticos.
              </p>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 8 — SUSPENSÃO E BANIMENTO</h4>
              <p>
                A plataforma reserva-se o direito de suspender ou banir permanentemente contas de
                apostadores que violem os termos de uso, incluindo, mas não se limitando a:
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Uso de bots ou automação para dar lances.</li>
                <li>Criação de múltiplas contas (multi-accounting).</li>
                <li>Fraude ou tentativa de fraude no sistema de pagamentos.</li>
                <li>Comportamento abusivo ou que prejudique outros participantes.</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 9 — PRIVACIDADE E DADOS</h4>
              <p>
                Os dados pessoais do APOSTADOR serão tratados conforme a Política de Privacidade
                da plataforma, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei
                nº 13.709/2018).
              </p>
            </section>

            <section>
              <h4 className="font-semibold">CLÁUSULA 10 — DISPOSIÇÕES GERAIS</h4>
              <p>
                Ao aceitar este contrato, o APOSTADOR declara ter lido, compreendido e concordado
                com todas as cláusulas aqui descritas. A aceitação eletrônica possui validade
                jurídica nos termos da legislação brasileira vigente.
              </p>
              <p className="mt-1">
                A plataforma reserva-se o direito de atualizar estes termos a qualquer momento,
                notificando os usuários sobre alterações significativas.
              </p>
            </section>
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
