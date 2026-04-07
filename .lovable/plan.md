

# Fix: QR Code não gerado no upgrade de plano

## Causa raiz

Na Edge Function `partner-upgrade-payment/index.ts`, ambas as funções (`processPlanUpgrade` e `processCotasUpgrade`) retornam `pixCopyPaste: null` hardcoded, ignorando o valor real retornado pelo gateway (`depositResult.pixCopyPaste`).

Sem a string EMV do PIX, o modal `PartnerPixPaymentModal` não consegue gerar o QR Code via `QRCodeSVG`.

## Correção

**1 arquivo**: `supabase/functions/partner-upgrade-payment/index.ts`

Duas linhas a alterar:

- Linha 141: `pixCopyPaste: null` → `pixCopyPaste: depositResult.pixCopyPaste`
- Linha 198: `pixCopyPaste: null` → `pixCopyPaste: depositResult.pixCopyPaste`

Após a edição, deploy da edge function `partner-upgrade-payment`.

## Impacto

- O QR Code voltará a ser exibido no modal de upgrade (plano e cotas)
- Nenhuma alteração no frontend necessária
- Nenhuma alteração de banco necessária

