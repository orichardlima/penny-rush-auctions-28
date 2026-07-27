# Diff do `trg_sync_bid_lots` / `sync_bid_lots_on_profile_update`

O trigger legado observa `profiles.bids_balance` e, quando percebe delta
positivo sem lote correspondente, cria `bid_lots(source='unknown')`.

## Regra nova

Antes de criar o lote `unknown`, consultar
`public.points_should_skip_unknown_lot(user_id, delta)`. Se retornar `true`,
não criar — a RPC canônica já criou o lote correto.

## Diff conceitual

```diff
 CREATE OR REPLACE FUNCTION public.sync_bid_lots_on_profile_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
 DECLARE v_delta integer;
 BEGIN
   v_delta := COALESCE(NEW.bids_balance,0) - COALESCE(OLD.bids_balance,0);
   IF v_delta <= 0 THEN RETURN NEW; END IF;

+  -- GUARD Fase 3: RPC canônica já criou o lote com metadados completos
+  IF public.points_should_skip_unknown_lot(NEW.id, v_delta) THEN
+    RETURN NEW;
+  END IF;

   INSERT INTO public.bid_lots (
     user_id, source, initial_amount, remaining_amount,
-    eligible_for_points
+    eligible_for_points, lot_status
   ) VALUES (
     NEW.id, 'unknown', v_delta, v_delta,
-    false
+    false, 'active'
   );
   RETURN NEW;
 END $$;
```

## Consequência

- Nenhum lote duplicado (`paid_purchase` + `unknown`) para a mesma compra.
- Reservas manuais / ajustes administrativos continuam gerando `unknown`
  (legado), pois nenhum `bid_purchase.credited_via_canonical_rpc=true` casa.
- Zero impacto até a RPC ser efetivamente chamada pelos webhooks (branch).
