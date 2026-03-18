

# Plano: Migrar de Mercado Pago para Asaas

## Correção importante

O sistema **ja coleta CPF** no cadastro (`src/pages/Auth.tsx`) e armazena em `profiles.cpf`. Isso elimina a "Questão Importante" do plano anterior -- o CPF do usuário está disponível para criar customers no Asaas sem nenhuma mudança no frontend de cadastro.

## Arquitetura

O fluxo PIX permanece igual para o usuário. Internamente, as Edge Functions passam a chamar `api.asaas.com` em vez de `api.mercadopago.com`.

```text
Frontend (mesmo)  →  Edge Function (reescrita)  →  Asaas API
                                                      ↓
                  ←  { qrCodeBase64, pixCopyPaste }  ←
                  
Asaas webhook  →  Edge Function (reescrita)  →  Atualiza DB
```

## Funções a criar/reescrever

| Função | Ação | Descrição |
|---|---|---|
| `supabase/functions/asaas-payment/index.ts` | **Criar** | Substitui `mercado-pago-payment`. Cria customer (se necessário) + cobrança PIX + busca QR Code |
| `supabase/functions/asaas-webhook/index.ts` | **Criar** | Substitui `mercado-pago-webhook`. Processa eventos `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` |
| `supabase/functions/order-pix-payment/index.ts` | **Reescrever** | Pagamento de produtos arrematados via Asaas |
| `supabase/functions/partner-payment/index.ts` | **Reescrever** | Aporte de parceiro via Asaas |
| `supabase/functions/partner-upgrade-payment/index.ts` | **Reescrever** | Upgrade de plano via Asaas |
| `supabase/functions/partner-payment-webhook/index.ts` | **Reescrever** | Webhook de parceiros para formato Asaas |

## Fluxo Asaas (3 chamadas)

1. **Buscar/Criar Customer**: `GET /v3/customers?email=X` → se vazio, `POST /v3/customers` com `{ name, email, cpfCnpj }`
2. **Criar Cobrança**: `POST /v3/payments` com `{ customer, billingType: "PIX", value, dueDate, externalReference }`
3. **Obter QR Code**: `GET /v3/payments/{id}/pixQrCode` → retorna `{ encodedImage, payload }`

## Mudança no Frontend

Apenas 1 arquivo: `src/hooks/usePurchaseProcessor.ts` -- trocar `'mercado-pago-payment'` por `'asaas-payment'`.

Os modais `PixPaymentModal.tsx` e `OrderPixPaymentModal.tsx` já usam `qrCodeBase64` e `pixCopyPaste`, que são os mesmos campos retornados pelo Asaas (`encodedImage` → `qrCodeBase64`, `payload` → `pixCopyPaste`).

## Secret necessário

- Adicionar: `ASAAS_API_KEY` nos secrets do Supabase
- O `MERCADO_PAGO_ACCESS_TOKEN` pode ser mantido ou removido posteriormente

## Webhook do Asaas

Formato de payload:
```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_xxx",
    "externalReference": "purchase-uuid",
    "status": "RECEIVED",
    "value": 50.00
  }
}
```

URL a configurar no painel Asaas:
- `https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/asaas-webhook`
- `https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/partner-payment-webhook`

## Ordem de implementação

1. Criar helper compartilhado para customer lookup/create (evitar duplicação nas 4 functions)
2. `asaas-payment` + `asaas-webhook` (fluxo principal de compra de lances)
3. `order-pix-payment` (pagamento de produtos)
4. `partner-payment` + `partner-upgrade-payment` + `partner-payment-webhook` (parceiros)
5. Atualizar `usePurchaseProcessor.ts` no frontend

