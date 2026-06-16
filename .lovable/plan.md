# Controles Admin para Encerramento de Parceiros

## Contexto
A tela de acompanhamento do ex-parceiro já está funcionando e mostra o prazo de **7 dias corridos** para pagamento do estorno após aprovação. Esse número vem da configuração `termination_refund_sla_days` no `system_settings`, inserida com valor padrão `7` pela última migração. Porém, **o admin ainda não tem interface para alterar esse prazo** nem para registrar o pagamento do estorno quando a liquidação for em PIX (PARTIAL_REFUND).

## Objetivo
Dar ao admin controle total sobre o fluxo de encerramento antecipado diretamente no painel já existente (`/admin/parceiros`), sem precisar editar banco de dados manualmente.

## Escopo
1. Configurar o prazo de estorno (SLA em dias corridos).
2. Na lista de encerramentos, indicar a data limite de pagamento para pedidos aprovados.
3. Adicionar ação "Marcar estorno como pago" para pedidos `APPROVED` com liquidação `PARTIAL_REFUND`, exigindo a referência do PIX.
4. Registrar auditoria das ações admin (mudança de prazo e confirmação de pagamento).

## O que será alterado

### 1. `src/components/Admin/AdminPartnerManagement.tsx`
Nova seção de configuração dentro da aba `process` ou próximo às configurações de fundo de parceiros:

- Campo numérico: **"Prazo para pagamento do estorno (dias corridos)"**.
- Botão **Salvar** que chama `updateSetting('termination_refund_sla_days', valor)`.
- Valor inicial vindo de `getSettingValue('termination_refund_sla_days', 7)`.

A aba `terminations` será aprimorada:
- Nova coluna ou linha de detalhe mostrando a **data limite de pagamento** para pedidos `APPROVED` (calculada como `approved_at + slaDays`).
- Quando `status === 'APPROVED'` e `liquidation_type === 'PARTIAL_REFUND'`, exibir botão **"Marcar como pago"**.
- Ao clicar, abrir um pequeno diálogo solicitando a **referência do pagamento PIX** (campo `payout_reference`) e confirmar.
- Ação chama `markTerminationPaid(term.id, payoutReference)` já existente em `useAdminPartners`.
- Pedidos `COMPLETED` exibem a data de pagamento e a referência, quando houver.

### 2. `src/hooks/useAdminPartners.ts`
A função `markTerminationPaid` já existe. Será ajustada para:
- Inserir registro em `admin_audit_log` com ação `TERMINATION_PAID`, registrando admin, ID do pedido, referência e valor final.
- Garantir que `processed_at` seja atualizado junto com `paid_at` e `status = 'COMPLETED'`.

A função `processTermination` será ajustada para:
- Inserir registro em `admin_audit_log` com ação `TERMINATION_APPROVED` ou `TERMINATION_REJECTED`, incluindo o valor final e tipo de liquidação.

### 3. Auditoria
Novos registros em `admin_audit_log`:
- `TERMINATION_APPROVED`: quando admin aprova encerramento.
- `TERMINATION_REJECTED`: quando admin recusa encerramento.
- `TERMINATION_PAID`: quando admin confirma pagamento do estorno.
- `UPDATE_TERMINATION_SLA`: quando admin altera o prazo de pagamento.

## Não está no escopo (v1)
- Envio automático de e-mail ao alterar prazo ou confirmar pagamento.
- Geração de PDF/recibo pelo admin (o próprio parceiro já pode imprimir a tela).
- Reabertura de pedido rejeitado ou cancelamento de pedido aprovado pelo parceiro.

## Fluxo esperado para o admin
```text
1. Admin acessa /admin/parceiros → aba "Encerramentos".
2. Vê solicitação PENDING de Sabriny → clica em aprovar.
3. Contrato é fechado, status vira APPROVED, sistema calcula data limite = approved_at + 7 dias.
4. Admin faz o PIX manualmente fora da plataforma.
5. Retorna à lista, clica "Marcar como pago" e informa a referência do PIX.
6. Status vira COMPLETED, parceiro vê "Pago em DD/MM/YYYY" e a referência na tela de acompanhamento.
```

## Técnico
- Sem migração de banco: colunas `approved_at`, `paid_at` e `payout_reference` já existem em `partner_early_terminations`; `termination_refund_sla_days` já existe em `system_settings`.
- Reutilizar o hook `useSystemSettings` (já importado em `AdminPartnerManagement.tsx`).
- Reutilizar os componentes de UI já usados no arquivo (Card, Input, Button, Dialog, Table, Badge).
- Seguir padrão de cores semânticas do projeto (Tailwind tokens), sem cores hexadecimais inseridas manualmente.