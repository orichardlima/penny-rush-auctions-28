

# Teste de Ponta a Ponta: Compra de Lances via Asaas

## Status Atual

O código está corretamente conectado:
- `usePurchaseProcessor.ts` chama `asaas-payment` e envia `userCpf` do perfil
- `asaas-payment` cria customer → cobrança PIX → QR Code
- `asaas-webhook` processa confirmação e credita lances
- `PixPaymentModal` escuta realtime na tabela `bid_purchases` para detectar pagamento
- `config.toml` tem `verify_jwt = false` para ambas as functions

## Problema Potencial: CORS Headers

As edge functions `asaas-payment` e `asaas-webhook` usam headers CORS incompletos. O Supabase JS client envia headers adicionais que precisam estar na allowlist:

```
// Atual (incompleto)
'authorization, x-client-info, apikey, content-type'

// Necessário
'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

Isso pode causar erro CORS no navegador ao chamar `asaas-payment`. Precisa ser corrigido em **todas** as edge functions Asaas.

## Plano de Correção e Teste

### 1. Corrigir CORS headers
Atualizar os `corsHeaders` em:
- `supabase/functions/asaas-payment/index.ts`
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/order-pix-payment/index.ts`
- `supabase/functions/partner-payment/index.ts`
- `supabase/functions/partner-upgrade-payment/index.ts`
- `supabase/functions/partner-payment-webhook/index.ts`

### 2. Teste manual pelo usuário
Após a correção dos CORS:
1. Fazer login com um usuário que tenha CPF cadastrado
2. Ir para a página de compra de lances
3. Clicar em "Comprar" em qualquer pacote
4. Verificar se o modal PIX aparece com QR Code e código copia-e-cola
5. (Opcional) Pagar o PIX e verificar se o webhook credita os lances

### Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-payment/index.ts` | Atualizar CORS headers |
| `supabase/functions/asaas-webhook/index.ts` | Atualizar CORS headers |
| `supabase/functions/order-pix-payment/index.ts` | Atualizar CORS headers |
| `supabase/functions/partner-payment/index.ts` | Atualizar CORS headers |
| `supabase/functions/partner-upgrade-payment/index.ts` | Atualizar CORS headers |
| `supabase/functions/partner-payment-webhook/index.ts` | Atualizar CORS headers |

