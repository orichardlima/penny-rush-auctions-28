

# Atualizar MagenPay para usar VPS Proxy (Porta 3000)

## Contexto

A integração direta com a API MagenPay falha por IP whitelisting. A VPS em `76.13.162.10:3000` já está configurada como proxy, fazendo a assinatura criptográfica internamente. Precisamos atualizar o `magen-auth.ts` para usar esse proxy com o novo formato JSON.

## O que muda

A VPS agora roda na **porta 3000** (antes era 3100) com endpoint `/pagamento` e espera um JSON com estrutura `{ keyId, body: { order_id, amount, currency, payment_method, customer } }`.

A resposta retorna `qr_code` e `pix_copy_and_paste`.

## Alteração

### `supabase/functions/_shared/magen-auth.ts`

Reescrever completamente para chamar a VPS em vez da API MagenPay direta:

- Remover toda a lógica de assinatura criptográfica (secp256k1, PEM parsing, DER encoding)
- Usar `VPS_MAGEN_URL` (secret já existente) como base URL, com fallback para `http://76.13.162.10:3000`
- Usar `VPS_AUTH_TOKEN` (secret já existente) para autenticação com a VPS
- Key ID fixo: `afd04971-db66-44f2-8111-0f8937cd0e90` (ou via `MAGEN_PUBLIC_KEY_ID`)
- Endpoint: `POST {VPS_URL}/pagamento`
- Body:
  ```json
  {
    "keyId": "afd04971-db66-44f2-8111-0f8937cd0e90",
    "body": {
      "order_id": "{txId}",
      "amount": 150.00,
      "currency": "BRL",
      "payment_method": "pix",
      "customer": { "name": "João", "email": "joao@email.com" }
    }
  }
  ```
- Mapear resposta: `qr_code` → `qrCodeBase64`, `pix_copy_and_paste` → `pixCopyPaste`
- Manter a mesma interface `createMagenDeposit` para compatibilidade com `payment-router.ts`

### Nenhum outro arquivo alterado

- `payment-router.ts` permanece igual (já chama `createMagenDeposit`)
- Webhooks permanecem iguais
- Frontend permanece igual

## Segurança

- Autenticação via `VPS_AUTH_TOKEN` no header `Authorization: Bearer {token}`
- Chave privada permanece exclusivamente na VPS
- Edge Functions não precisam mais das secrets `MAGEN_PRIVATE_KEY` / `MAGEN_PIX_KEY_ID`

