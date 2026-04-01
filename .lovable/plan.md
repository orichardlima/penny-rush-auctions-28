

# Botão "Pagar Agora" no Banner de Inadimplência

## Resumo

Adicionar botão no banner de inadimplência do PartnerDashboard que gera um pagamento PIX com o valor do aporte do contrato. Ao confirmar pagamento, o `financial_status` é atualizado para `paid` automaticamente via webhook.

## Arquitetura

Usa o padrão de prefixo no `external_id` já existente (`regularize:{contractId}`) para roteamento nos webhooks.

## Alterações

### 1. Nova Edge Function: `partner-regularize-payment/index.ts`

- Recebe `contractId`, `userId`, `userEmail`, `userName`, `userCpf`
- Valida que o contrato existe, pertence ao user, status ACTIVE e `financial_status !== 'paid'`
- Chama `createDeposit` do payment-router com `externalId: 'regularize:{contractId}'`
- Retorna QR Code / pixCopyPaste para o frontend

### 2. Webhook VeoPag: `veopag-webhook/index.ts`

- Adicionar rota `regularize:` no roteamento por prefixo
- Nova função `processRegularizationPayment`: quando aprovado, faz `UPDATE partner_contracts SET financial_status = 'paid', financial_status_note = 'Pagamento regularizado via PIX' WHERE id = contractId`

### 3. Webhook MagenPay: `magen-webhook/index.ts`

- Mesma rota `regularize:` com mesma lógica de atualização

### 4. Frontend: `src/components/Partner/PartnerDashboard.tsx`

- Adicionar estado `regularizationLoading` e `regularizationPaymentData`
- Função `handleRegularize` que chama `supabase.functions.invoke('partner-regularize-payment', ...)`
- Botão "Pagar agora" no banner de inadimplência
- Ao clicar, gera pagamento e abre `PartnerPixPaymentModal` com os dados
- No `onSuccess`, faz `refreshData()` para atualizar o contrato

### 5. Hook: `src/hooks/usePartnerContract.ts`

- Nenhuma alteração necessaria — o `refreshData` já existe e recarrega o contrato

## Fluxo

```text
[Banner] → Clica "Pagar agora"
        → Chama edge function partner-regularize-payment
        → Retorna QR Code PIX
        → Abre PartnerPixPaymentModal
        → Parceiro paga
        → Webhook recebe confirmação (prefix regularize:)
        → UPDATE financial_status = 'paid'
        → Modal detecta via polling no partner_payment_intents
        → refreshData() → banner desaparece
```

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/partner-regularize-payment/index.ts` | Nova edge function |
| `supabase/functions/veopag-webhook/index.ts` | Rota `regularize:` |
| `supabase/functions/magen-webhook/index.ts` | Rota `regularize:` |
| `src/components/Partner/PartnerDashboard.tsx` | Botão + modal no banner |

## Nao sera alterado

- Nenhum fluxo existente de pagamento, webhook ou compra de lances
- Nenhuma tabela ou migration (usa campos existentes)
- Nenhum outro componente

