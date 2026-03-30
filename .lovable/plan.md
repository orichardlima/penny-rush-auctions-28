

# Multi-Gateway PIX: Admin escolhe o banco no painel

## Resumo

Criar um sistema onde **ambos os gateways (VeoPag e MagenPay)** ficam integrados simultaneamente, e o administrador escolhe qual usar através de uma configuração no painel, sem precisar alterar código.

## Como funciona

1. Uma nova configuração `active_payment_gateway` na tabela `system_settings` define qual gateway está ativo (`veopag` ou `magenpay`)
2. Um módulo compartilhado `payment-router.ts` lê essa configuração e roteia automaticamente para o gateway correto
3. No painel admin (SystemSettings), um dropdown permite trocar entre VeoPag e MagenPay instantaneamente
4. As 4 Edge Functions de pagamento usam o router em vez de chamar um gateway diretamente

```text
Admin Panel                    Edge Functions
┌─────────────┐     ┌────────────────────────────┐
│ Gateway: [▼]│     │  veopag-payment            │
│  ○ VeoPag   │     │  order-pix-payment         │
│  ● MagenPay │     │  partner-payment            │
│             │     │  partner-upgrade-payment     │
└─────────────┘     └─────────┬──────────────────┘
       │                      │
       ▼                      ▼
  system_settings      payment-router.ts
  active_payment_      ┌──────┴──────┐
  gateway=magenpay     │             │
                  veopag-auth   magen-auth
```

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/payment-router.ts` | **Novo** — módulo que lê `system_settings.active_payment_gateway` e chama o gateway correto |
| `supabase/functions/veopag-payment/index.ts` | Trocar import de `createMagenDeposit` por `createDeposit` do router |
| `supabase/functions/order-pix-payment/index.ts` | Mesmo |
| `supabase/functions/partner-payment/index.ts` | Mesmo |
| `supabase/functions/partner-upgrade-payment/index.ts` | Mesmo |
| `src/components/SystemSettings.tsx` | Adicionar dropdown "Gateway de Pagamento PIX" na aba de configurações |
| Nova migration SQL | Inserir `active_payment_gateway` = `veopag` na tabela `system_settings` |

## Detalhes técnicos

### payment-router.ts

```text
- Recebe supabase client + parâmetros unificados (amount, externalId, description, payerName, payerEmail, payerDocument)
- Consulta system_settings WHERE setting_key = 'active_payment_gateway'
- Se 'veopag': chama createVeopagDeposit (com external_id + payer object)
- Se 'magenpay': chama createMagenDeposit (com txId + payerName/payerTaxId)
- Retorna formato padronizado: { transactionId, pixCopyPaste, qrCodeBase64, qrCodeUrl, status, amount }
- Ambos os _shared auth modules permanecem intactos
```

### Cada Edge Function

A mudança em cada função é mínima — trocar:
```text
import { createMagenDeposit } from '../_shared/magen-auth.ts'
const result = await createMagenDeposit({...})
```
Por:
```text
import { createDeposit } from '../_shared/payment-router.ts'
const result = await createDeposit(supabase, {...})
```

### Admin UI

Um novo card na aba de configurações do sistema:
- Título: "Gateway de Pagamento PIX"
- Dropdown com opções: VeoPag, MagenPay
- Indicador visual do gateway ativo
- Botão salvar

### Webhooks

Cada gateway tem seu próprio webhook (`veopag-webhook` e `magen-webhook`), ambos ficam ativos simultaneamente. Quando o admin troca o gateway, apenas novos pagamentos usam o novo banco — pagamentos pendentes continuam sendo confirmados pelo webhook do banco original.

## O que NÃO muda

- Frontend (modais PIX, QR codes) — sem alterações
- `veopag-auth.ts` e `magen-auth.ts` — permanecem intactos
- Webhooks — ambos continuam funcionando
- Saques (PIX OUT) — continuam na VeoPag
- Fluxo de compra do usuário — transparente

