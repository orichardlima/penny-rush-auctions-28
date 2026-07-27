# Diff do `sync_bid_lots_on_profile_update` — v2

## Regra

O trigger legado observa `profiles.bids_balance` e cria
`bid_lots(source='unknown')` para deltas positivos sem lote correspondente.

Na v2 o GUARD é feito por **GUC LOCAL** definido pela RPC canônica dentro da
transação: `points.canonical_credit_active` guarda o `bid_purchase_id` que
está sendo creditado neste exato momento. O frontend **não** pode setar essa
GUC — ela só é ativada por `set_config(..., true)` (escopo transação) dentro
da RPC `SECURITY DEFINER`.

## Diff conceitual

```diff
 CREATE OR REPLACE FUNCTION public.sync_bid_lots_on_profile_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
 DECLARE
   v_delta integer;
+  v_canonical uuid;
 BEGIN
   v_delta := COALESCE(NEW.bids_balance,0) - COALESCE(OLD.bids_balance,0);
   IF v_delta <= 0 THEN RETURN NEW; END IF;

+  -- GUARD Fase 3 v2: se estamos DENTRO da RPC canônica de crédito,
+  -- o lote canônico já foi (ou está sendo) inserido — NÃO criar 'unknown'.
+  v_canonical := public.points_canonical_credit_active();
+  IF v_canonical IS NOT NULL THEN
+    RETURN NEW;
+  END IF;

   INSERT INTO public.bid_lots (
     user_id, source, initial_amount, remaining_amount,
-    eligible_for_points
+    eligible_for_points, payment_eligible_for_points, lot_status
   ) VALUES (
     NEW.id, 'unknown', v_delta, v_delta,
-    false
+    false, false, 'active'
   );
   RETURN NEW;
 END $$;
```

## Por que não usar mais o marcador `bid_purchases.credited_via_canonical_rpc`?

Continuamos usando o marcador (para fins de auditoria e para o trigger
`points_should_skip_unknown_lot` em cenários fora de transação), mas a
decisão em tempo real dentro do mesmo `UPDATE profiles` disparado pela RPC
é feita via GUC. Isso elimina a janela de corrida em que o `UPDATE
bid_purchases` ainda não commitou quando o trigger dispara.

## Verificação pós-op (dentro da RPC)

A RPC snapshotta `bids_balance` antes do INSERT e valida depois que:

```
new_balance - old_balance = initial_amount do lote inserido
```

Divergência → `RAISE EXCEPTION` (rollback integral da transação).

## Consequência

- Zero duplicação `paid_purchase` + `unknown`.
- Ajustes administrativos fora da RPC continuam criando `unknown` (legado).
- Frontend **não** consegue forçar o skip: nem via header, nem via RPC —
  `points_canonical_credit_active` só retorna `uuid` durante execução da RPC
  privada.
