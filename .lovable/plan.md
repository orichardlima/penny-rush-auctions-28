

# Migração PIX IN: VeoPag → MagenPay

## Resumo

Substituir a VeoPag pela MagenPay para todos os recebimentos PIX (compra de lances, adesão a planos, upgrades, pedidos). Saques (PIX OUT) continuam na VeoPag.

## Autenticação MagenPay

A MagenPay usa assinatura ECDSA/SHA256 com chave privada PEM. Cada request precisa de:
- `X-Signature`: assinatura base64 do `signedData`
- `X-Timestamp`, `X-Nonce`, `X-Public-Key-ID`

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/magen-auth.ts` | **Novo** — função `createMagenDeposit()` com assinatura ECDSA |
| `supabase/functions/veopag-payment/index.ts` | Trocar import de `createVeopagDeposit` → `createMagenDeposit` |
| `supabase/functions/partner-payment/index.ts` | Idem |
| `supabase/functions/partner-upgrade-payment/index.ts` | Idem |
| `supabase/functions/order-pix-payment/index.ts` | Idem |
| `supabase/functions/magen-webhook/index.ts` | **Novo** — recebe `pixRequestIn` da MagenPay, roteia igual ao veopag-webhook |
| `supabase/functions/_shared/veopag-auth.ts` | Mantém `createVeopagWithdrawal()` (saques continuam VeoPag) |

## Secrets necessários (manual no painel Supabase)

- `MAGEN_BASE_URL` = `https://api.magenpay.io`
- `MAGEN_PUBLIC_KEY_ID` = seu public key ID
- `MAGEN_PRIVATE_KEY` = chave privada PEM (secp256k1)
- `MAGEN_PIX_KEY_ID` = keyId da chave PIX cadastrada na MagenPay

## Detalhes técnicos

### 1. `magen-auth.ts` (novo shared)

```text
- buildSignedData(method, url, body) → { method, path, query, body, timestamp, nonce }
- signRequest(privateKeyPem, signedData) → base64 signature usando crypto.createSign("SHA256")
- createMagenDeposit({ amount, txId, description, payerName, payerTaxId, keyId })
  → POST /qrcode/api/v1/external/instant
  → Retorna { pixCopiaECola, txId, status }
  → Interface de retorno compatível com createVeopagDeposit (mesmos campos)
```

Nota: Deno usa `crypto.subtle` (Web Crypto API). Importaremos a chave PEM como PKCS8 e assinaremos com ECDSA P-256 + SHA-256.

### 2. Adaptação nas 4 edge functions de pagamento

Mudança mínima: trocar `import { createVeopagDeposit }` por `import { createMagenDeposit }` e ajustar os parâmetros:
- `external_id` → `txId` (formato: `bids_<purchaseId>`, `order:<orderId>`, etc.)
- `payer.name/document` → `payerName/payerTaxId`

O retorno será mapeado para a mesma estrutura (`pixCopyPaste`, `qrCodeBase64: ''`, etc.) para não alterar o frontend.

### 3. `magen-webhook/index.ts` (novo)

```text
- Recebe POST com { type: "pixRequestIn", data: { txId, amount, status, endToEndId } }
- Valida type === "pixRequestIn" e data.status === "success"
- Extrai txId → roteia igual ao veopag-webhook:
  - "order:" → processOrderPayment
  - "upgrade:" → processUpgradePayment
  - "cotas-upgrade:" → processCotasUpgradePayment
  - "withdrawal:" → ignora (saques são VeoPag)
  - UUID → tenta partner_payment_intent, depois bid_purchase
- Reutiliza as mesmas funções de processamento do veopag-webhook (extraídas para shared ou duplicadas)
```

### 4. Frontend

Nenhuma alteração. O retorno de `createMagenDeposit` será mapeado para `{ pixCopyPaste, qrCodeBase64: '', transactionId, status }` — o `PixPaymentModal` já renderiza QRCodeSVG quando `qrCodeBase64` está vazio.

### 5. Webhook URL

Na criação do depósito, o `callbackUrl` ou campo equivalente apontará para:
`{SUPABASE_URL}/functions/v1/magen-webhook`

A MagenPay precisa ser configurada no painel deles para enviar webhooks para essa URL (ou o campo no body do request, se suportado).

## Fluxo

```text
1. Usuário compra lances
2. Edge function cria cobrança na MagenPay (POST /qrcode/api/v1/external/instant)
3. Frontend exibe QR Code via QRCodeSVG (pixCopiaECola)
4. Usuário paga
5. MagenPay envia webhook pixRequestIn → magen-webhook
6. Webhook valida, credita lances/ativa contrato
```

## Ordem de implementação

1. Adicionar secrets no painel Supabase (manual)
2. Criar `magen-auth.ts`
3. Criar `magen-webhook/index.ts`
4. Atualizar as 4 edge functions de pagamento
5. Testar com sandbox da MagenPay

