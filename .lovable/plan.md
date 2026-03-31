

# Integração MagenPay via VPS Proxy (IP Fixo)

## Contexto

A MagenPay exige IP fixo para autenticação. Supabase Edge Functions têm IP dinâmico. A solução é usar a VPS (76.13.162.10) como proxy que faz a assinatura e comunicação com a MagenPay.

## O que será feito

### 1. Criar o microserviço para a VPS (Node.js)

Arquivo gerado para deploy na VPS: um servidor Express/Hono com dois endpoints:

- **POST /magen/create-qrcode** — recebe os dados do Supabase, assina com secp256k1 + SHA-256, envia para `POST https://api.magenpay.io/qrcode/api/v1/external/instant`, retorna o QR Code
- **GET /magen/payment-status/:txId** — consulta status de um pagamento

Autenticação Supabase→VPS via header `Authorization: Bearer <VPS_AUTH_TOKEN>`.

Toda a lógica de assinatura (PEM parsing, signedData, nonce, timestamp) será portada do `magen-auth.ts` existente para Node.js.

Variáveis de ambiente na VPS:
```
MAGEN_BASE_URL, MAGEN_PUBLIC_KEY_ID, MAGEN_PRIVATE_KEY, MAGEN_PIX_KEY_ID, VPS_AUTH_TOKEN
```

### 2. Alterar `magen-auth.ts` (Supabase)

Em vez de chamar a MagenPay diretamente, `createMagenDeposit` passará a chamar a VPS:

```
POST http://76.13.162.10:3100/magen/create-qrcode
Authorization: Bearer <VPS_AUTH_TOKEN>
Body: { amount, txId, description, payerName, payerTaxId, keyId }
```

Remover toda a lógica de assinatura secp256k1 do arquivo — a VPS cuida disso.

### 3. Adicionar secret `VPS_AUTH_TOKEN`

Um token compartilhado entre Supabase e VPS para autenticar as chamadas.

### 4. Webhook — sem alteração

O `magen-webhook` continua recebendo webhooks diretamente da MagenPay no Supabase (a MagenPay chama a URL do Supabase, não precisa de IP fixo para receber webhooks). Nenhuma mudança necessária.

## Arquivos

| Arquivo | Ação |
|---|---|
| `/mnt/documents/magen-vps-proxy/server.js` | **Novo** — microserviço Node.js para VPS |
| `/mnt/documents/magen-vps-proxy/package.json` | **Novo** — dependências |
| `/mnt/documents/magen-vps-proxy/.env.example` | **Novo** — template de env vars |
| `supabase/functions/_shared/magen-auth.ts` | **Modificar** — chamar VPS em vez da MagenPay diretamente |

## Detalhes técnicos

**Microserviço VPS (server.js):**
- Express + `@noble/secp256k1` + `@noble/hashes`
- Porta 3100
- Middleware de autenticação via Bearer token
- Mesma lógica de assinatura do `magen-auth.ts` atual (PEM→privkey, signedData, SHA-256, secp256k1 sign, base64)
- Logs estruturados

**magen-auth.ts simplificado:**
- Remove imports de `@noble/secp256k1` e `@noble/hashes`
- Remove funções `pemToPrivateKeyBytes`, `buildSignedData`, `signData`, `generateNonce`
- `createMagenDeposit` faz fetch para `VPS_URL/magen/create-qrcode` com Bearer token
- Lê `VPS_AUTH_TOKEN` e `VPS_MAGEN_URL` dos env vars

