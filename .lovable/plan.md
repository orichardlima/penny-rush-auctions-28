
# Página de Acompanhamento do Encerramento (Ex-Parceiro)

## Objetivo
Dar transparência e profissionalismo ao parceiro que solicitou encerramento antecipado: ele precisa ver claramente **o que pediu, o que vai receber, quando vai receber e tudo que já recebeu antes** — em vez de simplesmente "sumir" do status de Parceiro.

## Onde aparece

1. **Nova rota** `/minha-parceria/encerramento` (ou aba dentro de `/minha-parceria` quando o contrato mais recente está `CLOSED` via `partner_early_terminations`).
2. **CTA no Dashboard** (`/dashboard`): quando o usuário é ex-parceiro (tem `partner_early_terminations.status` em `PENDING`/`APPROVED`/`COMPLETED` e nenhum contrato `ACTIVE`), substituir o card roxo "Seja um Parceiro Investidor!" por um card "Acompanhar meu encerramento" + link para a página nova. Abaixo, manter um CTA secundário "Contratar novo plano".
3. **Badge** no topo do perfil: "Contrato Encerrado em DD/MM/AAAA" (cinza, discreto).

## Conteúdo da página

### Seção 1 — Status do Encerramento (hero)
- Status grande com cor semântica:
  - `PENDING` → amarelo: "Em análise pela equipe"
  - `APPROVED` → azul: "Aprovado — aguardando pagamento"
  - `COMPLETED` → verde: "Estorno concluído"
  - `REJECTED` → vermelho: "Recusado" + motivo (`admin_notes`)
- Timeline horizontal com 4 marcos:
  1. **Solicitado** — `requested_at`
  2. **Aprovado** — `processed_at` (quando status virou APPROVED)
  3. **Pago** — data do PIX de estorno
  4. **Concluído** — `processed_at` final
- Card "Prazo estimado para recebimento": `processed_at (aprovação) + N dias úteis` (N vindo de `system_settings.termination_refund_sla_days`, default 7). Mostrar contador "Faltam X dias úteis" ou "Atrasado há X dias" se passou do SLA.

### Seção 2 — Detalhamento Financeiro (transparência total)
Tabela limpa, sem jargão:

| Item | Valor |
|---|---|
| Aporte original | R$ `aporte_original` |
| Teto total do contrato (2x aporte) | R$ `aporte_original * 2` |
| Total já recebido em payouts semanais | R$ `total_received` |
| Saldo restante do teto (que você abriria mão) | R$ `remaining_cap` |
| Deságio aplicado sobre o aporte | `discount_percentage`% |
| Cálculo: (Aporte × (1 - deságio%)) − Total recebido | R$ `proposed_value` |
| **Valor final do estorno** | **R$ `final_value`** (ou `proposed_value` se ainda pendente) |
| Forma de liquidação | PIX / Créditos / Lances (`liquidation_type`) |

Com tooltip "Como calculamos?" abrindo um modal com a fórmula completa e exemplo numérico.

### Seção 3 — Histórico de Payouts Recebidos
Lista cronológica de todos os `partner_payouts` do contrato encerrado:
- Data, semana de referência, valor base, valor de ads, total pago, status.
- Total acumulado no rodapé (deve bater com `total_received`).

### Seção 4 — Histórico de Bônus de Indicação
Tabela de `partner_referral_bonuses` ligados a este contrato (indicações que ele patrocinou e que geraram bônus pré-encerramento).

### Seção 5 — Dados do Contrato Encerrado
Card resumo: plano contratado, data de ativação, data de encerramento, número de quotas, sponsor, posição binária (ainda preservada — explicar que continua na árvore para não quebrar uplines/downlines).

### Seção 6 — Próximos Passos
Três cards lado a lado:
1. **"Contratar novo plano"** → leva a `/minha-parceria` na aba de planos (contrato novo, separado, com novo cap).
2. **"Falar com suporte"** → link de contato/WhatsApp (caso o estorno atrase).
3. **"Baixar comprovante"** → PDF com todo o detalhamento acima (pode ser fase 2; v1 = botão "Imprimir" via `window.print()` com CSS de impressão).

## Mudanças técnicas

### Banco de dados
1. **`system_settings`** — adicionar chave `termination_refund_sla_days` (default `7`) para parametrizar o prazo.
2. **`partner_early_terminations`** — adicionar colunas:
   - `approved_at TIMESTAMPTZ` (separar do `processed_at` que hoje é usado para ambos)
   - `paid_at TIMESTAMPTZ` (quando o PIX de estorno saiu)
   - `payout_reference TEXT` (id da transação Veopag, para auditoria)
3. **Backfill**: para registros `COMPLETED` existentes, copiar `processed_at` para `paid_at` e `approved_at`.

### RLS
A política existente de `partner_early_terminations` já permite o owner ler. Verificar/garantir SELECT para o próprio usuário. Sem mudança de grants.

### Frontend
- Nova rota em `src/App.tsx`: `/minha-parceria/encerramento`.
- Novo componente `src/components/Partner/EncerramentoDashboard.tsx` com as 6 seções.
- Hook `useTerminationDetails(contractId)` reaproveitando `usePartnerEarlyTermination` + queries de `partner_payouts` e `partner_referral_bonuses`.
- Ajuste no `UserDashboard.tsx`: detectar ex-parceiro e renderizar card "Acompanhar encerramento" no lugar do CTA atual.
- Sem mexer no fluxo de criação/aprovação do encerramento (já existe e funciona).

### Admin
Adicionar ao painel admin (`AdminPartnerManagement`) campos para preencher `paid_at` e `payout_reference` ao confirmar o pagamento do estorno. Sem isso a timeline da seção 1 fica incompleta.

## Fora do escopo (deixar para depois)
- Geração de PDF server-side (v1 usa print do browser).
- Notificação automática por e-mail quando passa de um marco para outro (pode ser fase 2 usando o sistema de e-mail já existente).
- Reabertura/cancelamento de pedido de encerramento pelo próprio usuário (já existe `cancelRequest` para `PENDING`; manter como está).

## Resumo do que muda na experiência da Sabriny (caso de uso real)
- Hoje: vê dashboard de usuário comum + CTA "Seja Parceiro". Não tem nenhuma informação sobre o encerramento.
- Depois: vê card "Seu estorno de R$ 11.887,50 está aprovado — previsão de pagamento até DD/MM" com link direto. Na página, vê toda a conta detalhada: aporte R$ 25.000, recebido R$ 5.612,50, deságio 30%, valor final R$ 11.887,50, lista dos payouts que recebeu, e botão para contratar um plano novo se quiser voltar.
