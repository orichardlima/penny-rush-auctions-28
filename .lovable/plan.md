

# Fix: QR Code PIX nao renderiza - string EMV, nao base64

## Diagnostico (dos logs)

A resposta da VeoPag retorna no campo `qrcode`:
```
"00020101021226810014br.gov.bcb.pix2559qr.woovi.com/qr/v2/cob/..."
```

Isso e uma **string EMV do PIX** (copia e cola), **NAO** uma imagem base64. O codigo atual tenta renderizar como `data:image/png;base64,00020101...` que resulta em imagem quebrada.

## Solucao

### 1. Instalar `qrcode.react` para gerar QR Code no frontend

Biblioteca leve que gera QR Code a partir de qualquer string.

### 2. Atualizar `veopag-auth.ts` - tratar o campo como PIX copia-e-cola

Retornar o valor de `qrcode` como `pixCopyPaste` (string para copiar) em vez de `qrCodeBase64`:

```typescript
return {
  transactionId: ...,
  pixCopyPaste: rawQr,  // string EMV para copia-e-cola
  qrCodeBase64: '',     // VeoPag nao retorna imagem
  qrCodeUrl: '',
}
```

### 3. Propagar `pixCopyPaste` pelo fluxo

- `veopag-payment/index.ts` → incluir `pixCopyPaste` na resposta
- `usePurchaseProcessor.ts` → propagar o campo

### 4. Atualizar `PixPaymentModal.tsx` e `OrderPixPaymentModal.tsx`

- Usar `<QRCodeSVG value={pixCopyPaste} />` para gerar QR Code visual
- Exibir o texto PIX copia-e-cola com botao de copiar
- Fallback: se existir `qrCodeBase64` ou `qrCodeUrl`, usar imagem como antes

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `package.json` | Adicionar `qrcode.react` |
| `supabase/functions/_shared/veopag-auth.ts` | Retornar `pixCopyPaste` com a string EMV |
| `supabase/functions/veopag-payment/index.ts` | Incluir `pixCopyPaste` na resposta |
| `src/hooks/usePurchaseProcessor.ts` | Propagar `pixCopyPaste` |
| `src/components/PixPaymentModal.tsx` | Gerar QR com `qrcode.react` + exibir copia-e-cola |
| `src/components/OrderPixPaymentModal.tsx` | Mesma correcao |

## Resultado

O QR Code sera gerado no frontend a partir da string PIX EMV. O usuario tambem podera copiar o codigo PIX manualmente.

