

# Atualizar Integração MagenPay para Nova API da VPS (Porta 3333)

## Resumo

A VPS MagenPay foi atualizada com nova porta (3333), novos endpoints e novo formato de request/response. Precisa atualizar o módulo `magen-auth.ts` para funcionar com a nova API.

## Mudancas Principais

| Item | Antes | Agora |
|---|---|---|
| Porta | 3000 | 3333 |
| Endpoint criar PIX | `/pagamento` | `/pix/criar` |
| KeyId padrão | `afd04971-...` (public key) | `e2aaacb3-...` (chave PIX EVP) |
| Request body | `{ keyId, body: { order_id, amount, currency, ... } }` | `{ amount, amountFormat, keyId, description, payerName, payerTaxId, expirationInSeconds }` |
| Response | flat `{ txId, pixCopiaECola, ... }` | `{ sucesso, dados: { txId, pixCopiaECola, ... } }` |

## Alterações

### 1. `supabase/functions/_shared/magen-auth.ts`

- Atualizar URL padrão para `http://76.13.162.10:3333`
- Atualizar `MAGEN_KEY_ID` padrão para `e2aaacb3-6a62-4880-9433-2116cf467b2e`
- Mudar endpoint de `/pagamento` para `/pix/criar`
- Reestruturar request body para o novo formato:
  ```typescript
  {
    amount: params.amount,
    amountFormat: "brl",
    amountType: "fixed",
    keyId: MAGEN_KEY_ID,
    description: params.description || "Pagamento PIX",
    expirationInSeconds: 3600,
    payerName: params.payerName,
    payerTaxId: params.payerTaxId
  }
  ```
- Atualizar parsing da resposta para extrair de `data.dados`:
  ```typescript
  const result = await res.json()
  const dados = result.dados || result
  return {
    transactionId: dados.txId || params.txId,
    status: dados.status || 'pending',
    pixCopyPaste: dados.pixCopiaECola || '',
    qrCodeBase64: '',
    qrCodeUrl: '',
    amount: params.amount
  }
  ```

### 2. `supabase/functions/magen-webhook/index.ts`

- Atualizar para aceitar o formato de webhook da nova VPS (se diferente)
- O webhook da VPS redireciona para `POST /webhook/pagamento` na própria VPS, e a VPS pode reenviar para o Supabase -- verificar se o formato do payload mudou

**Nota**: O `payment-router.ts` e demais Edge Functions que consomem `createMagenDeposit` não precisam de alteração, pois a interface de retorno permanece a mesma.

### Nenhum outro arquivo do frontend alterado

