

# Saque Automático via VeoPag (PIX OUT)

## Resumo

Quando o admin clicar em "Marcar como Pago", o sistema enviará automaticamente o PIX para o parceiro via API da VeoPag (`POST /api/withdrawals/withdraw`), em vez de apenas marcar no banco e exigir transferência manual.

## API VeoPag Withdrawal (dos prints)

```text
POST https://api.veopag.com/api/withdrawals/withdraw
Auth: Bearer {token}

Body (PIX Key):
{
  amount, external_id, pix_key, key_type (CPF|CNPJ|EMAIL|PHONE_EVP),
  taxId, name, description, clientCallbackUrl
}

Response: { message, withdrawal: { transaction_id, status: "COMPLETED", amount, fee } }
```

## Implementação

### 1. Nova função em `_shared/veopag-auth.ts` — `createVeopagWithdrawal`

Adicionar função que chama `POST /api/withdrawals/withdraw` com:
- `amount`: valor do saque
- `external_id`: `withdrawal:{withdrawalId}` (idempotência)
- `pix_key`: chave PIX do parceiro
- `key_type`: tipo da chave (CPF, CNPJ, EMAIL, PHONE_EVP)
- `taxId`: CPF do parceiro (dos payment_details ou profile)
- `name`: nome do titular
- `description`: "Saque parceiro - Penny Rush"
- `clientCallbackUrl`: URL do webhook para confirmação

Retorna `{ transaction_id, status, amount, fee }`.

### 2. Atualizar `process-partner-withdrawal/index.ts`

Fluxo atual: marca como PAID no banco (manual).
Novo fluxo:
1. Chamar `createVeopagWithdrawal` com dados do saque
2. Se VeoPag retornar `status: "COMPLETED"` → marcar como PAID
3. Se falhar → retornar erro sem alterar status, admin pode tentar novamente
4. Salvar `transaction_id` e `fee` no `payment_details`

### 3. Atualizar webhook `veopag-webhook/index.ts`

Adicionar roteamento para prefixo `withdrawal:` no `external_id`:
- Localizar saque pelo ID
- Se status VeoPag === COMPLETED e saque ainda APPROVED → marcar como PAID
- Idempotência: ignorar se já PAID

### 4. Frontend — `AdminPartnerManagement.tsx`

Alterar texto do botão de "Marcar como Pago" para "Enviar PIX" e atualizar toast de sucesso para refletir envio automático. Adicionar feedback de erro caso a VeoPag rejeite (saldo insuficiente, chave inválida, etc).

### 5. Frontend — `useAdminPartners.ts`

Atualizar toast em `markWithdrawalAsPaid` para mostrar que o PIX foi enviado automaticamente (não mais manual).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/veopag-auth.ts` | Nova função `createVeopagWithdrawal` |
| `supabase/functions/process-partner-withdrawal/index.ts` | Chamar VeoPag antes de marcar PAID |
| `supabase/functions/veopag-webhook/index.ts` | Roteamento `withdrawal:` no external_id |
| `src/components/Admin/AdminPartnerManagement.tsx` | Texto do botão → "Enviar PIX" |
| `src/hooks/useAdminPartners.ts` | Toast de sucesso atualizado |

## Segurança

- Apenas admins podem acionar o endpoint (validação já existe)
- `external_id` com prefixo `withdrawal:` garante idempotência
- Webhook valida se saque existe e está em status APPROVED antes de confirmar
- Falha na VeoPag não altera status do saque (admin pode retentar)

