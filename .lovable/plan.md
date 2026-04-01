

# Adicionar Botão "Marcar como Pago" Manual nos Saques de Parceiros

## Problema

O botão "Marcar como Pago" chama a Edge Function `process-partner-withdrawal` que tenta enviar PIX automaticamente via VeoPag. A VeoPag rejeita com `Unauthorized IP address` porque os IPs dinâmicos do Supabase Edge Functions não estão na whitelist. Não existe opção para o admin confirmar manualmente um PIX já enviado por fora.

## Solução

Adicionar um segundo botão **"Confirmar Pagamento Manual"** no dialog de confirmação, que atualiza diretamente o status do saque para `PAID` no banco sem chamar a VeoPag.

## Alterações

### 1. `src/hooks/useAdminPartners.ts`

- Adicionar função `markWithdrawalAsPaidManually(withdrawalId)` que:
  - Atualiza `partner_withdrawals` com `status = 'PAID'`, `paid_at = now()`, `paid_by = adminUserId` e `payment_details.paid_via = 'manual'`
  - Atualiza `total_withdrawn` no `partner_contracts`
  - Sem chamar nenhuma Edge Function
- Exportar a nova função

### 2. `src/components/Admin/AdminPartnerManagement.tsx`

- Importar `markWithdrawalAsPaidManually` do hook
- No dialog de confirmação (linha ~1682), adicionar um segundo botão **"Confirmar Pagamento Manual"** abaixo do botão "Enviar PIX Automático"
- Estilo diferenciado (variant outline/secondary) para distinguir do PIX automático

### Nada mais alterado

- Edge Function `process-partner-withdrawal` permanece intacta
- Nenhum outro componente, tabela ou fluxo modificado

