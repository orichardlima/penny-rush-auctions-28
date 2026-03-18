

# Webhook retornando 404 para pagamentos não relacionados

## Problema

O e-mail do Asaas mostra que o webhook `partner-payment-webhook` está retornando **HTTP 404** para pagamentos que não foram gerados pela plataforma. Nos logs, vemos pagamentos como `pay_2gbu439jo2nzypwt` com `externalReference: null` -- são PIX recebidos diretamente na conta Asaas, não gerados pelo sistema.

O fluxo atual:
1. Webhook recebe notificação de pagamento
2. Tenta encontrar por `payment_id` em `partner_payment_intents` -- não encontra
3. Tenta encontrar por `externalReference` (que é `null`) -- não encontra
4. Tenta fallback em `partner_contracts` por `payment_id` -- não encontra
5. Retorna `404 Not Found`

O Asaas interpreta o 404 como erro e envia e-mails de alerta.

## Correção

Alterar o `processLegacyContractPayment` em `partner-payment-webhook/index.ts` para retornar **200 OK** em vez de **404** quando não encontrar o pagamento. Pagamentos não reconhecidos devem ser ignorados silenciosamente (com log informativo), não tratados como erro.

### Arquivo: `supabase/functions/partner-payment-webhook/index.ts`

Na função `processLegacyContractPayment`, linha que retorna 404:
```typescript
// DE:
return new Response('Not found', { status: 404, headers: corsHeaders })

// PARA:
console.log('ℹ️ Payment not related to partner contracts, ignoring:', paymentId)
return new Response('OK', { status: 200, headers: corsHeaders })
```

Isso resolve o alerta do Asaas sem afetar nenhuma funcionalidade, pois pagamentos legítimos da plataforma sempre terão `externalReference` ou `payment_id` correspondente.

