
DROP INDEX IF EXISTS public.bid_lots_gateway_extid_uk;
DROP INDEX IF EXISTS public.bid_lots_payment_ident_uidx;

CREATE UNIQUE INDEX bid_lots_gateway_extid_source_uk
  ON public.bid_lots (payment_gateway, external_payment_id, source)
  WHERE payment_gateway IS NOT NULL AND external_payment_id IS NOT NULL;

CREATE UNIQUE INDEX bid_lots_payment_ident_source_uidx
  ON public.bid_lots (payment_environment, payment_gateway, gateway_account_id, external_payment_id, source)
  WHERE payment_environment IS NOT NULL AND payment_gateway IS NOT NULL AND external_payment_id IS NOT NULL;
