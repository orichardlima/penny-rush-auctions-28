

## Diagnóstico

A edge function `order-pix-payment` está **funcionando perfeitamente** — os logs mostram que a MagenPay retorna o `pixCopiaECola` (código copia-e-cola) corretamente.

**O problema está no frontend, em `src/components/UserOrders.tsx` (linhas 113-119):**

```ts
setPixPaymentData({
  paymentId: data.paymentId,
  qrCode: data.qrCode,
  qrCodeBase64: data.qrCodeBase64,
  pixCopyPaste: data.pixCopyPaste   // ❌ Backend nunca retorna isso!
});
```

Olhando a edge function `order-pix-payment/index.ts` (linhas 73-79), a resposta é:
```ts
{
  orderId,
  paymentId,
  qrCodeBase64,    // vem vazio na MagenPay (não retorna imagem)
  pixCopyPaste: null,   // ❌ Hardcoded como null!
  status
}
```

A função **descarta** o `pixCopyPaste` retornado pela MagenPay (forçando `null`) e a MagenPay **não retorna `qrCodeBase64`** (só retorna `pixCopiaECola`).

Resultado: o modal abre vazio — sem QR code, sem botão "Copiar código PIX". É exatamente o que aparece na sua screenshot: só "Aguardando pagamento" e "Já fiz o pagamento".

## Correção (1 arquivo)

Editar `supabase/functions/order-pix-payment/index.ts` para repassar o `pixCopyPaste` real do `depositResult` (que já vem do `payment-router` → `magen-auth`):

```ts
const response = {
  orderId: order.id,
  paymentId: depositResult.transactionId,
  qrCodeBase64: depositResult.qrCodeBase64,
  qrCodeUrl: depositResult.qrCodeUrl,
  pixCopyPaste: depositResult.pixCopyPaste,  // ← era null, passa o real
  status: depositResult.status
}
```

O modal `OrderPixPaymentModal.tsx` já trata esse caso: quando só há `pixCopyPaste` (sem `qrCodeBase64`/`qrCodeUrl`), ele **gera o QR code no cliente** via `<QRCodeSVG value={pixCopyPaste} />` (linhas 152-154). Então tanto o QR quanto o botão "Copiar código PIX" passarão a aparecer.

### Fora de escopo
- UI do modal (já está correta).
- Webhook de confirmação (já funcional).
- Frontend `UserOrders.tsx` (já lê `pixCopyPaste` do response).
- Outras edge functions de pagamento (partner, upgrade, etc).

### Resultado esperado
Ao clicar em "Pagar com PIX", o modal abre com QR Code escaneável + botão "Copiar código PIX" funcional, idêntico ao fluxo de pacotes de lances.

