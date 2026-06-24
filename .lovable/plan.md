## Problema

No modal "Confirmar Pagamento PIX" do admin (`src/components/Admin/AdminPartnerManagement.tsx`, linhas ~2003-2070), o campo "Valor do Saque" exibe `withdrawal.amount` (bruto). O admin precisa ver o valor líquido — o que realmente será enviado via PIX após desconto da taxa — para não pagar a mais.

A coluna `net_amount` já existe nos registros de saque (usada em outro cálculo na linha 291) e `fee_amount` é gravado no momento da solicitação.

## Mudança

Apenas UI, escopo restrito ao modal de confirmação PIX (e ao texto "Copiar Todos os Dados" para consistência).

### 1. Bloco "Valor do Saque" (linhas ~2020-2024)
Exibir o líquido em destaque e bruto/taxa como referência menor:

```
Valor Líquido a Pagar
R$ X,XX        ← destaque (net_amount)

Bruto: R$ Y,YY • Taxa: R$ Z,ZZ   ← linha pequena, muted
```

Fallback: se `net_amount` for `null/undefined` (saques antigos), usar `amount` e omitir a linha de bruto/taxa.

### 2. `copyAllPixData` (linha 317)
Trocar `withdrawal.amount` por `withdrawal.net_amount ?? withdrawal.amount` para que "Copiar Todos os Dados" leve o valor que efetivamente será pago.

## Fora de escopo

- Não alterar fluxo do parceiro, listagem de saques, totais, ordenação, edge function de pagamento, schema ou qualquer outra UI.
