

# Fix QR Code VeoPag - PIX EMV string tratada como base64

## Problema raiz

Em `veopag-auth.ts` linha 97, a string PIX EMV (ex: `00020101...`) cai no `else` e é atribuída a `qrCodeBase64`. No frontend (`PixPaymentModal.tsx` linha 273), a condição `!paymentData.qrCodeBase64` é `false`, então renderiza `<img src="data:image/png;base64,00020101...">` -- imagem quebrada.

## Correção

### 1. `supabase/functions/_shared/veopag-auth.ts`

Detectar string PIX EMV (começa com `0002`) e **não** atribuir a `qrCodeBase64`:

```typescript
if (rawQr.startsWith('http')) {
  qrCodeUrl = rawQr
} else if (rawQr.startsWith('data:')) {
  qrCodeBase64 = rawQr.replace(/^data:image\/\w+;base64,/, '')
} else if (rawQr.startsWith('0002') || rawQr.length < 100) {
  // PIX EMV copy-paste string, NOT a base64 image
  // Leave qrCodeBase64 empty, frontend will use QRCodeSVG
} else {
  qrCodeBase64 = rawQr
}
```

Isso garante que `qrCodeBase64` fica vazio e `pixCopyPaste` (já setado na linha 106) carrega a string EMV.

### 2. Frontend - sem mudanças necessárias

A lógica atual nos modais já funciona corretamente quando `qrCodeBase64` é vazio:
- Linha 273: `pixCopyPaste && !qrCodeBase64 && !qrCodeUrl` → `true` → renderiza `<QRCodeSVG>`
- Copy-paste, polling, botão "Já fiz o pagamento" já implementados

### 3. Re-deploy da edge function `veopag-payment`

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/veopag-auth.ts` | Não atribuir string PIX EMV a `qrCodeBase64` |

## Resultado

`qrCodeBase64` ficará vazio → frontend usa `QRCodeSVG` para gerar QR visual → imagem funciona.

