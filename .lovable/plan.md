

# Integração Direta MagenPay (sem VPS proxy)

## Resumo

Reescrever `magen-auth.ts` para chamar a API da MagenPay diretamente do Supabase Edge Functions, usando `@noble/secp256k1` e `@noble/hashes` via `esm.sh` para gerar as assinaturas ECDSA. Elimina a dependência da VPS como proxy.

## Por que funciona

A biblioteca `@noble/secp256k1` é pure-JS e compatível com Deno/Supabase Edge Functions via `esm.sh`. Não precisa de Node.js nem de IP fixo para a assinatura — o IP fixo é exigido apenas se a MagenPay tiver whitelist de IP, mas a autenticação real é feita via assinatura criptográfica nos headers.

**Importante**: Se a MagenPay realmente exige whitelist de IP (não apenas assinatura), a integração direta falhará com erro de IP não autorizado. Nesse caso, a VPS continua necessária. Mas vale tentar direto primeiro.

## Arquivo alterado

### `supabase/functions/_shared/magen-auth.ts`

**Remover**: toda referência à VPS (`VPS_MAGEN_URL`, `VPS_AUTH_TOKEN`, fetch para `76.13.162.10`)

**Adicionar**:
1. Imports de `@noble/secp256k1` e `@noble/hashes/sha256` via esm.sh
2. Função `pemToPrivateKeyBytes(pem)` — extrai bytes da chave privada PEM
3. Função `generateNonce()` — UUID v4 único por request
4. Função `buildSignedData(method, path, query, body, timestamp, nonce)` — monta o objeto de assinatura
5. Função `signData(signedData, privateKey)` — SHA-256 + secp256k1 sign → Base64 DER

**`createMagenDeposit`** passará a:
1. Ler `MAGEN_BASE_URL`, `MAGEN_PUBLIC_KEY_ID`, `MAGEN_PRIVATE_KEY`, `MAGEN_PIX_KEY_ID` dos env vars
2. Montar o body do request
3. Gerar timestamp (ISO), nonce, signedData
4. Assinar com secp256k1
5. Chamar `POST https://api.magenpay.io/qrcode/api/v1/external/instant` com headers `X-Signature`, `X-Timestamp`, `X-Nonce`, `X-Public-Key-ID`
6. Retornar `transactionId`, `pixCopyPaste`, `qrCodeBase64`, etc.

## Secrets necessários no Supabase

| Secret | Descrição |
|---|---|
| `MAGEN_BASE_URL` | `https://api.magenpay.io` |
| `MAGEN_PUBLIC_KEY_ID` | `40347448-c87f-46be-ad59-d2376f84f370` |
| `MAGEN_PRIVATE_KEY` | Chave privada PEM (já fornecida pelo usuário) |
| `MAGEN_PIX_KEY_ID` | ID da chave PIX (já fornecido pelo usuário) |

## Detalhes técnicos

```typescript
// Imports compatíveis com Deno/Supabase Edge Functions
import * as secp from 'https://esm.sh/@noble/secp256k1@2.1.0'
import { sha256 } from 'https://esm.sh/@noble/hashes@1.4.0/sha256'
import { hmac } from 'https://esm.sh/@noble/hashes@1.4.0/hmac'

// Necessário para habilitar sign síncrono
secp.etc.hmacSha256Sync = (k, ...m) => 
  hmac(sha256, k, secp.etc.concatBytes(...m))
```

Headers obrigatórios por request:
- `X-Signature`: assinatura DER em Base64
- `X-Timestamp`: ISO string
- `X-Nonce`: UUID único
- `X-Public-Key-ID`: ID da chave pública

## Nenhuma alteração na UI, webhook ou payment-router

