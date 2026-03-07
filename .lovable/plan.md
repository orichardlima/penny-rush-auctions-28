

## Plano: Integrar pagamento PIX automático nos pedidos de leilões arrematados

### Problema
Atualmente, o ganhador precisa fazer um PIX manual e enviar comprovante. O sistema já possui integração com Mercado Pago PIX (QR Code + detecção automática) para compra de lances. O mesmo fluxo deve ser aplicado aos pedidos.

### Alterações

#### 1. Nova Edge Function: `order-pix-payment`
Cria um pagamento PIX no Mercado Pago para um pedido (`orders`). Recebe `orderId`, `userId`, `userEmail`, `userName`. Busca o pedido, gera pagamento via API do Mercado Pago com `external_reference` prefixado (`order:{orderId}`), salva o `payment_id` no pedido e retorna QR Code + copia-e-cola.

#### 2. Atualizar Edge Function: `mercado-pago-webhook`
Quando o `external_reference` começar com `order:`, buscar na tabela `orders` (em vez de `bid_purchases`), atualizar status para `paid` e registrar `payment_method: 'PIX'`.

#### 3. Migração SQL: adicionar coluna `payment_id` na tabela `orders`
```sql
ALTER TABLE orders ADD COLUMN payment_id text;
```

#### 4. Componente: `OrderPixPaymentModal.tsx`
Modal similar ao `PixPaymentModal.tsx` existente, mas adaptado para pedidos. Mostra QR Code, código PIX copia-e-cola, detecta pagamento automaticamente via realtime na tabela `orders` + polling de backup. Ao detectar `status = 'paid'`, exibe confirmação.

#### 5. Atualizar `UserOrders.tsx`
- Remover fluxo de upload de comprovante (estados `paymentProof`, `uploading`, `handlePaymentProofUpload`)
- Botão "Pagar com PIX" chama a Edge Function `order-pix-payment` e abre o `OrderPixPaymentModal`
- Manter exibição de pedidos, status e rastreamento intactos

### Fluxo resultante
1. Ganhador vê pedido "Aguardando Pagamento" → clica "Pagar com PIX"
2. Sistema gera QR Code via Mercado Pago → exibe no modal
3. Usuário paga → webhook atualiza status automaticamente → modal detecta e confirma

