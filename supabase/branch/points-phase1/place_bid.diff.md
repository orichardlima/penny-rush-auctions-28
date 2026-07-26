# Diff unificado — `public.place_bid`

Baseline capturado de produção via `pg_get_functiondef`:

```diff
 CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
 DECLARE
   v_balance numeric;
+  v_bid_id  uuid;
+  v_program_on          boolean := public.points_get_bool('points_program_enabled', false);
+  v_accrual_on          boolean := public.points_get_bool('points_accrual_enabled', false);
+  v_consumption_on      boolean := public.points_get_bool('points_lot_consumption_enabled', false);
+  v_started_at          timestamptz := public.points_get_time('points_accrual_started_at');
+  v_pilot               jsonb   := public.points_get_json('points_pilot_users');
+  v_is_bot boolean := false; v_is_admin boolean := false; v_is_test boolean := false;
+  v_in_pilot boolean := false;
+  v_accrual_active_snap boolean;
+  v_tracking text;
+  v_eligible boolean := false;
+  v_source   text := NULL;
+  v_lot_id   uuid := NULL;
+  v_rows     json := NULL;
 BEGIN
+  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
+    RAISE EXCEPTION 'forbidden';
+  END IF;
+
-  SELECT bids_balance INTO v_balance
-  FROM profiles WHERE user_id = p_user_id FOR UPDATE;
+  SELECT bids_balance, COALESCE(is_bot,false), COALESCE(is_admin,false),
+         COALESCE(is_test_account,false)
+    INTO v_balance, v_is_bot, v_is_admin, v_is_test
+    FROM profiles WHERE user_id = p_user_id FOR UPDATE;

   IF v_balance IS NULL OR v_balance < 1 THEN
     RAISE EXCEPTION 'Saldo insuficiente';
   END IF;
+
+  v_in_pilot := (v_pilot ? p_user_id::text);
+  v_accrual_active_snap := v_consumption_on AND v_started_at IS NOT NULL AND now() > v_started_at;
+  v_tracking := CASE WHEN v_accrual_active_snap THEN 'tracked' ELSE 'pre_cutoff' END;
+
+  IF v_consumption_on THEN
+    BEGIN
+      SELECT json_agg(row_to_json(t)) INTO v_rows FROM (
+        SELECT * FROM public.preview_consume_bid_lots(p_user_id, 1)
+      ) t;
+      IF v_rows IS NOT NULL THEN
+        SELECT bool_and((r->>'eligible')::boolean),
+               (v_rows->0->>'source'), ((v_rows->0->>'lot_id')::uuid)
+          INTO v_eligible, v_source, v_lot_id
+          FROM json_array_elements(v_rows) r;
+      END IF;
+    EXCEPTION WHEN OTHERS THEN
+      INSERT INTO public.points_bid_reconciliation_queue(user_id,reason,requested_amount)
+        VALUES (p_user_id, SQLERRM, 1);
+      v_rows := NULL; v_eligible := false;
+    END;
+  END IF;
+
+  IF v_is_bot OR v_is_admin OR v_is_test OR NOT v_in_pilot OR NOT v_accrual_active_snap THEN
+    v_eligible := false;
+  END IF;

   PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
   UPDATE profiles SET bids_balance = bids_balance - 1 WHERE user_id = p_user_id;
   PERFORM set_config('app.allow_sensitive_profile_update', '', true);

-  INSERT INTO bids (auction_id, user_id, bid_amount, cost_paid)
-  VALUES (p_auction_id, p_user_id, 1, 1.00);
+  INSERT INTO bids(
+    auction_id, user_id, bid_amount, cost_paid,
+    source, lot_id, eligible_for_points, is_test,
+    points_program_active_at_bid, points_accrual_active_at_bid,
+    accrual_started_at_snapshot, tracking_status
+  ) VALUES (
+    p_auction_id, p_user_id, 1, 1.00,
+    v_source, v_lot_id, v_eligible, v_is_test,
+    v_program_on, v_accrual_active_snap, v_started_at, v_tracking
+  ) RETURNING id INTO v_bid_id;
+
+  IF v_rows IS NOT NULL THEN
+    PERFORM public.commit_bid_lot_consumptions(v_bid_id, v_rows);
+  END IF;
 END;
 $function$;
```

## Notas de segurança/comportamento

- **Auditoria de triggers em `bids`** (executada em prod):
  - BEFORE INSERT: `tr_prevent_invalid_bids`, `trg_block_bot_when_target_leading`
  - AFTER INSERT: `bids_refresh_last_bidders`, `fury_vault_bid_trigger`, `update_auction_on_bid`, `trg_cancel_scheduled_on_real_bid`
  - AFTER UPDATE: **nenhum**
  - Portanto o único INSERT do bid já traz todos os snapshots — não há segundo trigger disparado por UPDATE de metadados.
- **Débito legado preservado**: `profiles.bids_balance -= 1` continua acontecendo com todas as flags off, mantendo compatibilidade total com o comportamento atual.
- **Bots/admin via service_role**: chamadas dos jobs de bot continuam funcionando porque `auth.uid()` é NULL em contexto de service_role, satisfazendo o guard `auth.uid() IS NOT NULL AND auth.uid() <> p_user_id`.
- **Fallback anti-pane**: se `preview_consume_bid_lots` falhar (saldo em lote insuficiente), a exceção é capturada, o item vai para `points_bid_reconciliation_queue`, e o bid segue apenas com o débito legado — o parceiro nunca é bloqueado por causa do módulo de pontos.
