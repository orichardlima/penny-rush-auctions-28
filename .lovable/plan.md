

# Fix: QR Code da VeoPag nao renderiza

## Problema

A edge function `veopag-payment` cria o deposito com sucesso (logs confirmam), mas o QR Code aparece quebrado no modal. O campo `data.qrCodeResponse?.qrcode` pode:
- Ser uma URL em vez de base64 puro
- Ja conter o prefixo `data:image/...`
- Ter um nome de campo diferente do esperado
- Estar vazio/undefined

Nao temos visibilidade porque o codigo nao loga a resposta completa da VeoPag.

## Solucao

### 1. Adicionar log da resposta completa na `veopag-auth.ts`

Em `createVeopagDeposit`, logo apos `const data = await res.json()`, adicionar:
```
console.log('📋 VeoPag full response:', JSON.stringify(data))
```

Isso nos mostra a estrutura exata retornada pela API.

### 2. Tratar multiplos formatos de QR Code na `veopag-auth.ts`

Ao retornar `qrCodeBase64`, verificar se o valor:
- E uma URL (comeca com `http`) → retornar como `qrCodeUrl`
- Ja tem prefixo `data:` → extrair so o base64
- E base64 puro → retornar como esta

```typescript
const rawQr = data.qrCodeResponse?.qrcode || data.qrCodeResponse?.qr_code || data.qrCodeResponse?.qrCode || ''
let qrCodeBase64 = ''
let qrCodeUrl = ''

if (rawQr.startsWith('http')) {
  qrCodeUrl = rawQr
} else if (rawQr.startsWith('data:')) {
  qrCodeBase64 = rawQr.replace(/^data:image\/\w+;base64,/, '')
} else if (rawQr.length > 0) {
  qrCodeBase64 = rawQr
}
```

### 3. Atualizar o frontend `PixPaymentModal.tsx` e `OrderPixPaymentModal.tsx`

Suportar tanto `qrCodeBase64` quanto `qrCodeUrl`:
- Se `qrCodeBase64` → usar `data:image/png;base64,...`
- Se `qrCodeUrl` → usar a URL diretamente como `src`

### 4. Propagar `qrCodeUrl` pelo fluxo

Atualizar `veopag-payment/index.ts` e `usePurchaseProcessor.ts` para incluir `qrCodeUrl` na resposta/interface.

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/_shared/veopag-auth.ts` | Log resposta completa + tratar formatos de QR |
| `supabase/functions/veopag-payment/index.ts` | Incluir `qrCodeUrl` na resposta |
| `src/hooks/usePurchaseProcessor.ts` | Adicionar `qrCodeUrl` na interface |
| `src/components/PixPaymentModal.tsx` | Renderizar QR por URL ou base64 |
| `src/components/OrderPixPaymentModal.tsx` | Mesma correcao |

## Resultado

Apos deploy, o proximo pagamento vai logar a resposta completa da VeoPag. O frontend vai renderizar o QR Code independente do formato retornado (URL, base64, ou data URI).

