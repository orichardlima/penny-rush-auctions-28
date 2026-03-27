

# Migrar Pagamentos do Asaas para VeoPag

## Resumo

Substituir completamente o Asaas pela VeoPag em todos os fluxos de pagamento PIX (compra de lances, adesao a parcerias, upgrade de plano/cotas, pagamento de pedidos).

## API VeoPag (extraido dos prints)

```text
Auth:    POST https://api.veopag.com/api/auth/login
         Body: { client_id, client_secret }
         Resp: { token, expires_in: 3600 }
         Usage: Authorization: Bearer TOKEN

Deposit: POST https://api.veopag.com/api/payments/deposit
         Headers: { Authorization: Bearer TOKEN }
         Body: { amount, external_id, clientCallbackUrl, payer: { name, email, document }, split? }
         Resp: { message, qrCodeResponse: { transactionId, status: "PENDING", qrcode: "base64...", amount } }

Webhook: POST to clientCallbackUrl (or portal config)
         Headers: { Authorization: Bearer CLIENT_CALLBACK_SECRET, X-Webhook-Signature (optional) }
         Payload: { type: "Deposit", external_id, transaction_id, status: "COMPLETED", amount, fee, payer_name, payer_cpf, ... }
         Statuses: PENDING, PROCESSING, COMPLETED, FAILED
```

## Diferencias chave Asaas vs VeoPag

| Aspecto | Asaas | VeoPag |
|---|---|---|
| Auth | API key no header `access_token` | OAuth `client_id/client_secret` → Bearer token |
| Customer | Precisa criar/buscar customer antes | Nao precisa - payer vai inline no deposit |
| QR Code | Endpoint separado `/pixQrCode` | Vem na resposta do deposit (`qrcode` base64) |
| Webhook payload | `{ event, payment: { id, externalReference, status } }` | `{ type, external_id, transaction_id, status }` |
| Status aprovado | RECEIVED/CONFIRMED | COMPLETED |

## Pre-requisitos (secrets)

Preciso configurar 2 secrets no Supabase:
- `VEOPAG_CLIENT_ID`
- `VEOPAG_CLIENT_SECRET`

Opcionalmente: `VEOPAG_WEBHOOK_SECRET` (se configurar signature no portal)

## Etapas de implementacao

### 1. Criar utilitario de auth VeoPag
**Novo:** `supabase/functions/_shared/veopag-auth.ts`
- Funcao `getVeopagToken()` que faz POST login com client_id/client_secret
- Cache do token em variavel de modulo (renovar quando expirar)

### 2. Criar `veopag-payment` (substitui `asaas-payment`)
**Novo:** `supabase/functions/veopag-payment/index.ts`
- Mesma logica de negocio (buscar pacote, promo, criar bid_purchase, comissao afiliado)
- Remover logica de customer Asaas
- Usar `POST /api/payments/deposit` com `{ amount, external_id: purchaseId, clientCallbackUrl, payer: { name, email, document: cpf } }`
- Retornar `qrCodeResponse.qrcode` como `qrCodeBase64` e `pixCopyPaste` (copia-cola nao existe separado na VeoPag - usar qrcode base64)

### 3. Criar `veopag-webhook` (substitui `asaas-webhook` + unifica com `partner-payment-webhook`)
**Novo:** `supabase/functions/veopag-webhook/index.ts`
- Recebe payload VeoPag: `{ type, external_id, transaction_id, status }`
- Valida Authorization header (se secret configurado)
- Idempotencia: verifica status atual antes de processar
- Roteamento por `external_id`:
  - UUID direto → bid_purchase OU partner_payment_intent
  - `order:{id}` → pedido
  - `upgrade:{contractId}:{planId}` → upgrade de plano
  - `cotas-upgrade:{contractId}:{cotas}` → upgrade de cotas
- So processa quando `status === 'COMPLETED'`
- Toda logica de processamento copiada dos webhooks atuais (creditar lances, ativar contrato, aprovar comissoes, etc.)

### 4. Atualizar `partner-payment` → VeoPag
**Editar:** `supabase/functions/partner-payment/index.ts`
- Remover logica Asaas (customer, charge, qrCode separado)
- Usar `getVeopagToken()` + `POST /api/payments/deposit`
- `external_id` = intentData.id
- `clientCallbackUrl` = URL do veopag-webhook

### 5. Atualizar `partner-upgrade-payment` → VeoPag
**Editar:** `supabase/functions/partner-upgrade-payment/index.ts`
- Mesma substituicao

### 6. Atualizar `order-pix-payment` → VeoPag
**Editar:** `supabase/functions/order-pix-payment/index.ts`
- Mesma substituicao, `external_id` = `order:{orderId}`

### 7. Atualizar frontend
**Editar:** `src/hooks/usePurchaseProcessor.ts`
- Mudar invoke de `asaas-payment` → `veopag-payment`

**Editar:** `src/components/PixPaymentModal.tsx`
- O QR Code ja usa `data:image/png;base64,${qrCodeBase64}` - compativel
- Remover referencia a `pixCopyPaste` se VeoPag nao retornar copia-cola separado (ou manter com fallback)

### 8. Configurar `supabase/config.toml`
- Adicionar `[functions.veopag-payment]` e `[functions.veopag-webhook]` com `verify_jwt = false`

## Arquivos modificados/criados

| Arquivo | Acao |
|---|---|
| `supabase/functions/_shared/veopag-auth.ts` | Criar - auth + cache de token |
| `supabase/functions/veopag-payment/index.ts` | Criar - substitui asaas-payment |
| `supabase/functions/veopag-webhook/index.ts` | Criar - webhook unificado |
| `supabase/functions/partner-payment/index.ts` | Editar - Asaas → VeoPag |
| `supabase/functions/partner-upgrade-payment/index.ts` | Editar - Asaas → VeoPag |
| `supabase/functions/order-pix-payment/index.ts` | Editar - Asaas → VeoPag |
| `supabase/config.toml` | Adicionar veopag-payment e veopag-webhook |
| `src/hooks/usePurchaseProcessor.ts` | invoke veopag-payment |

## Proximo passo

Antes de implementar, preciso que voce configure os secrets `VEOPAG_CLIENT_ID` e `VEOPAG_CLIENT_SECRET` no Supabase. Voce ja tem essas credenciais na sua conta VeoPag?

