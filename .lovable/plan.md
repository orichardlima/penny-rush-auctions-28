

# Fix: magen-auth.ts — secp256k1 em vez de P-256

## Problema

A MagenPay exige assinatura com curva **secp256k1**, mas o `magen-auth.ts` atual usa `P-256` via Web Crypto API. O Deno `crypto.subtle` não suporta secp256k1.

## Solução

Usar a biblioteca `@noble/secp256k1` (pura JS, sem dependências nativas, compatível com Deno via esm.sh) para:
1. Importar a chave privada PEM (secp256k1)
2. Assinar o `signedData` com SHA-256 + secp256k1
3. Retornar a assinatura em base64

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/magen-auth.ts` | Trocar `crypto.subtle` (P-256) por `@noble/secp256k1` via esm.sh |

## Detalhes técnicos

```text
- Import: import * as secp from "https://esm.sh/@noble/secp256k1@2.1.0"
- Import: import { sha256 } from "https://esm.sh/@noble/hashes@1.6.1/sha256"
- PEM → raw 32-byte private key (strip ASN.1/DER envelope)
- Sign: secp.sign(sha256(dataStr), privateKeyBytes)
- Encode signature to base64
- Resto do código (buildSignedData, createMagenDeposit, headers) permanece igual
```

A chave privada secp256k1 em PEM é DER-encoded com um envelope ASN.1. Precisamos extrair os 32 bytes raw da chave privada para usar com `@noble/secp256k1`.

