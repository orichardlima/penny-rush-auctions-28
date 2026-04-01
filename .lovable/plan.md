

# Fix: QR Code não aparece no pagamento de Parceiro

## Problema

Duas falhas no fluxo de pagamento de parceiro:

1. **`pixCopyPaste` hardcoded como `null`** no `partner-payment/index.ts` (linha 201). O valor EMV retornado pela VeoPag é descartado.
2. **Modal não gera QR Code a partir da string EMV**. O `PartnerPixPaymentModal` tenta renderizar `qrCodeBase64` como imagem base64, mas a VeoPag retorna uma string EMV (começa com `0002`), não uma imagem. O modal de compra de lances (`PixPaymentModal`) funciona porque usa `QRCodeSVG` para gerar o QR a partir da string EMV.

## Solução

### 1. `supabase/functions/partner-payment/index.ts`

Linha 201: trocar `pixCopyPaste: null` por `pixCopyPaste: depositResult.pixCopyPaste || null`

### 2. `src/components/Partner/PartnerPixPaymentModal.tsx`

- Importar `QRCodeSVG` de `qrcode.react`
- Na renderização do QR Code, usar a mesma lógica do `PixPaymentModal`:
  - Se `qrCodeBase64` existe → renderizar `<img>` com base64
  - Se `pixCopyPaste` existe e começa com `0002` (string EMV) → renderizar `<QRCodeSVG value={pixCopyPaste}>`
  - Mostrar botão "Copiar código PIX" quando `pixCopyPaste` estiver disponível

### 3. Deploy

Fazer deploy da edge function `partner-payment` com a correção.

## Impacto

- Corrige a geração do QR Code para pagamento de parceiro
- Não altera nenhum outro fluxo (compra de lances, upgrade, etc.)
- Nenhuma alteração no banco de dados

