# Diffs dos webhooks — v2 (BRANCH — não redeployar)

## Objetivo

1. Extrair **payment_confirmed_at** SEMPRE do payload autenticado do gateway
   (nunca `now()` como fonte primária).
2. Enviar **identidade completa** e **hash do payload** para idempotência e
   auditoria.
3. Se o gateway não fornecer confirmação temporal confiável, passar
   `p_payment_confirmed_at = null` — a RPC canônica marcará o lote como
   `pending_reconciliation` (não utilizável pelo programa até reconciliação
   administrativa).

## `supabase/functions/veopag-webhook/index.ts` — `processBidPurchase`

```diff
   if (isApproved && purchase.payment_status !== 'completed') {
+    // 1) Extrair timestamp confiável do gateway (NÃO usar now() como fonte)
+    const gatewayConfirmedAt: string | null =
+      body.paid_at ?? body.confirmed_at ?? body.data?.paidAt ?? null   // vindo do payload assinado
+    const gatewayCreatedAt: string | null =
+      body.created_at ?? body.data?.createdAt ?? null
+    const payloadHash = await crypto.subtle
+      .digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)))
+      .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2,'0')).join(''))
+
     await supabase
       .from('bid_purchases')
-      .update({ payment_status: 'completed' })
+      .update({
+        payment_status: 'completed',
+        payment_confirmed_at: gatewayConfirmedAt,     // pode ser null → pending_reconciliation
+        payment_created_at:   gatewayCreatedAt,
+        webhook_received_at:  new Date().toISOString(),
+        gateway_event_id:     body.event_id ?? transaction_id,
+        gateway_payload_hash: payloadHash,
+        gateway_account_id:   Deno.env.get('VEOPAG_ACCOUNT_ID') ?? null,
+        payment_environment:  Deno.env.get('APP_ENV') ?? 'production',
+      })
       .eq('id', purchase.id)

-    const { error: creditErr } = await supabase.rpc('credit_purchase_bids', {
-      p_user_id: purchase.user_id,
-      p_amount:  purchase.bids_purchased,
-      p_purchase_id: purchase.id,
-    })
+    const { data: creditRes, error: creditErr } = await supabase.rpc(
+      'credit_paid_bid_purchase',
+      {
+        p_user_id:              purchase.user_id,
+        p_bid_purchase_id:      purchase.id,
+        p_bids_amount:          purchase.bids_purchased,
+        p_amount_paid:          purchase.amount_paid,
+        p_payment_environment:  Deno.env.get('APP_ENV') ?? 'production',
+        p_payment_gateway:      'veopag',
+        p_gateway_account_id:   Deno.env.get('VEOPAG_ACCOUNT_ID') ?? null,
+        p_external_payment_id:  transaction_id ?? body.transaction_id,
+        p_gateway_event_id:     body.event_id ?? transaction_id,
+        p_gateway_payload_hash: payloadHash,
+        p_payment_created_at:   gatewayCreatedAt,
+        p_payment_confirmed_at: gatewayConfirmedAt,      // null → pending_reconciliation
+        p_webhook_received_at:  new Date().toISOString(),
+      },
+    )
+    if (creditErr) console.error('❌ credit_paid_bid_purchase failed:', creditErr)
+    else            console.log('✅ Canonical credit:', creditRes)
   } else if (isRejected) {
     await supabase
       .from('bid_purchases')
       .update({ payment_status: 'failed' })
       .eq('id', purchase.id)
+
+    await supabase.rpc('reverse_paid_bid_purchase', {
+      p_bid_purchase_id:  purchase.id,
+      p_reversal_type:    body.reason === 'chargeback' ? 'chargeback' : 'cancelled',
+      p_gateway_event_id: body.event_id ?? `${transaction_id}:rejected`,
+      p_amount:           purchase.amount_paid,
+      p_notes:            'veopag rejection webhook',
+    })
   }
```

## `supabase/functions/magen-webhook/index.ts`

Mesma substituição estrutural — `p_payment_gateway='magenpay'`, extrair
`confirmedAt`/`paidAt` do payload; se ausente, passar `null` para acionar
`pending_reconciliation`.

## Notas de segurança

- `webhook_secret` / assinatura do gateway deve ser validada ANTES de qualquer
  chamada à RPC. O frontend não pode invocar `credit_paid_bid_purchase`
  (função privada, `REVOKE` para anon/authenticated).
- `gateway_payload_hash` permite auditar o payload exato considerado no
  crédito, sem armazená-lo por inteiro no ledger.
- `pending_reconciliation`: o admin deve rodar reconciliação (consulta à API
  do gateway) antes de confirmar o lote. Item de backlog operacional.
