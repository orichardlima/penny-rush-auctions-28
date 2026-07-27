# Diffs dos webhooks (BRANCH — não redeployar)

## Objetivo

Substituir a criação direta de lote/saldo por chamada única à RPC canônica
`credit_paid_bid_purchase`, passando **payment_confirmed_at** vindo do gateway
(nunca `now()`) e a **identidade completa do pagamento** para a chave de
idempotência.

## `supabase/functions/veopag-webhook/index.ts` — `processBidPurchase`

```diff
   if (isApproved && purchase.payment_status !== 'completed') {
     console.log('✅ Bid payment approved, updating purchase and user balance')

     await supabase
       .from('bid_purchases')
-      .update({ payment_status: 'completed' })
+      .update({
+        payment_status: 'completed',
+        payment_confirmed_at: body.paid_at ?? body.confirmed_at ?? new Date().toISOString(),
+        webhook_received_at: new Date().toISOString(),
+      })
       .eq('id', purchase.id)

-    const { error: creditErr } = await supabase.rpc('credit_purchase_bids', {
-      p_user_id: purchase.user_id,
-      p_amount: purchase.bids_purchased,
-      p_purchase_id: purchase.id,
-    })
-    if (creditErr) {
-      console.error('❌ credit_purchase_bids failed:', creditErr)
-    }
+    const { data: creditRes, error: creditErr } = await supabase.rpc(
+      'credit_paid_bid_purchase',
+      {
+        p_user_id: purchase.user_id,
+        p_bid_purchase_id: purchase.id,
+        p_bids_amount: purchase.bids_purchased,
+        p_amount_paid: purchase.amount_paid,
+        p_payment_environment: Deno.env.get('APP_ENV') ?? 'production',
+        p_payment_gateway: 'veopag',
+        p_gateway_account_id: Deno.env.get('VEOPAG_ACCOUNT_ID') ?? null,
+        p_external_payment_id: transactionId ?? body.transaction_id,
+        p_payment_created_at: body.created_at ?? null,
+        p_payment_confirmed_at: body.paid_at ?? body.confirmed_at ?? new Date().toISOString(),
+        p_webhook_received_at: new Date().toISOString(),
+      },
+    )
+    if (creditErr) console.error('❌ credit_paid_bid_purchase failed:', creditErr)
+    else            console.log('✅ Canonical credit:', creditRes)
```

Adicionar branch de reversão (novo bloco, junto ao `isRejected`):

```diff
   } else if (isRejected) {
     console.log('❌ Bid payment rejected')
     await supabase
       .from('bid_purchases')
       .update({ payment_status: 'failed' })
       .eq('id', purchase.id)
+
+    await supabase.rpc('reverse_paid_bid_purchase', {
+      p_bid_purchase_id: purchase.id,
+      p_reversal_type: body.reason === 'chargeback' ? 'chargeback' : 'cancelled',
+      p_gateway_event_id: body.event_id ?? `${transactionId}:rejected`,
+      p_amount: purchase.amount_paid,
+      p_notes: 'veopag rejection webhook',
+    })
```

## `supabase/functions/magen-webhook/index.ts`

Mesma substituição estrutural: trocar `credit_purchase_bids` por
`credit_paid_bid_purchase`, com `p_payment_gateway='magenpay'` e
`p_payment_confirmed_at` extraído do payload da MagenPay
(`payload.confirmedAt` ou equivalente — não usar `now()`).

## Colunas novas em `bid_purchases`

A migration adiciona (parte de `003_up.sql`):
- `payment_created_at   timestamptz`
- `payment_confirmed_at timestamptz`
- `webhook_received_at  timestamptz`

Já cobertas em `ALTER TABLE public.bid_purchases` no `003_up.sql` — se faltarem,
adicionar:

```sql
ALTER TABLE public.bid_purchases
  ADD COLUMN IF NOT EXISTS payment_created_at   timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_received_at  timestamptz;
```
