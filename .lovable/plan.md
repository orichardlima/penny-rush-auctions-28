

# Integrar Polling de Status via VPS MagenPay + Corrigir 406

## Diagnóstico

1. **QR Code gerado com sucesso** — a integração com a VPS funciona (confirmei com testes diretos)
2. **Problema**: o PixPaymentModal faz polling no Supabase (`bid_purchases.payment_status`), mas quando o gateway é MagenPay, o webhook pode não estar chegando para atualizar o status no Supabase
3. **Erros 406**: vêm de requisições GET à tabela `profiles` — provavelmente RLS bloqueando SELECT em cenários específicos (polling no `bid_purchases` pode também ter problemas pois a tabela não tem política INSERT para o frontend)

## Solução

### 1. Nova Edge Function: `magen-check-status`

Criar uma Edge Function que:
- Recebe `txId` e `purchaseId` no body
- Faz GET para `http://76.13.162.10:3333/pix/status/{txId}`
- Se `dados.status === 'paid'`:
  - Atualiza `bid_purchases` para `payment_status = 'completed'`
  - Incrementa `bids_balance` no perfil do usuário
  - Aprova comissões de afiliados pendentes (mesma lógica do webhook)
- Retorna o status atual para o frontend

### 2. Atualizar `PixPaymentModal.tsx`

Modificar o polling de backup para:
- Em vez de consultar Supabase diretamente, chamar a Edge Function `magen-check-status` a cada 5 segundos
- Enviar `txId` (do `paymentData.paymentId`) e `purchaseId`
- Quando a resposta indicar `paid`, fechar o modal e mostrar sucesso
- Manter o realtime subscription do Supabase como fallback (para VeoPag que usa webhook)

Para isso, o `PixPaymentModal` precisa receber o `txId` do retorno do pagamento. Atualmente já recebe via `paymentData.paymentId`.

### 3. Corrigir erros 406 — RLS no `bid_purchases`

Adicionar política RLS de UPDATE na tabela `bid_purchases` para a service role (já funciona via Edge Function com service key). Os erros 406 no frontend vêm do SELECT — verificar se o header `Accept` está correto nas requisições. Na verdade, o 406 na screenshot está em `/rest/v1/profile...` — vou adicionar um `Accept: application/json` header ou ajustar o `.select()` para evitar isso.

Porém, como o UPDATE será feito pela Edge Function (com service_role_key), não pelo frontend, os 406 no frontend não afetarão o fluxo de crédito.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/magen-check-status/index.ts` | Criar (nova Edge Function) |
| `src/components/PixPaymentModal.tsx` | Alterar polling para chamar `magen-check-status` |
| `supabase/functions/_shared/magen-auth.ts` | Sem alteração |
| `src/hooks/usePurchaseProcessor.ts` | Sem alteração |

## Fluxo Final

```text
1. Usuário clica "Comprar"
2. Frontend → Edge Function veopag-payment → payment-router → VPS /pix/criar
3. QR Code exibido no modal
4. Polling a cada 5s: Frontend → Edge Function magen-check-status → VPS /pix/status/{txId}
5. Quando status = 'paid':
   - Edge Function atualiza bid_purchases → completed
   - Edge Function credita bids_balance no profiles
   - Edge Function aprova comissões de afiliados
   - Frontend recebe confirmação → fecha modal + mensagem de sucesso
```

