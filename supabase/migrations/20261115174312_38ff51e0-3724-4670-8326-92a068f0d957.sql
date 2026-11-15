-- =====================================================================
-- Comissão de afiliado em compras confirmadas fora do webhook (MagenPay)
-- Causa: magenpay_apply_paid apenas APROVA comissões que já existem como
-- 'pending'. Quem CRIA a comissão são as funções de checkout/webhook
-- (VeoPag, Asaas, Mercado Pago). Nenhuma delas roda na rota MagenPay,
-- então a compra é paga e nenhuma comissão nasce.
-- Correção: criar a comissão no instante em que a compra passa a 'completed',
-- para qualquer rota de pagamento, de forma idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ensure_affiliate_commission_for_purchase(p_purchase_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  b public.bid_purchases%rowtype;
  ref public.affiliate_referrals%rowtype;
  a public.affiliates%rowtype;
  v_prev bigint;
  v_is_repurchase boolean;
  v_rate numeric;
  v_amount numeric;
BEGIN
  SELECT * INTO b FROM public.bid_purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped', 'purchase_not_found'); END IF;
  IF coalesce(b.payment_status, '') <> 'completed' THEN RETURN jsonb_build_object('skipped', 'not_completed'); END IF;

  -- Idempotência: nunca criar segunda comissão para a mesma compra.
  IF EXISTS (SELECT 1 FROM public.affiliate_commissions c WHERE c.purchase_id = b.id) THEN
    RETURN jsonb_build_object('skipped', 'commission_exists');
  END IF;

  -- Vínculo de indicação do comprador (o mais recente, se houver mais de um).
  SELECT * INTO ref FROM public.affiliate_referrals r
    WHERE r.referred_user_id = b.user_id
    ORDER BY r.created_at DESC
    LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped', 'no_referral'); END IF;

  SELECT * INTO a FROM public.affiliates af
    WHERE af.id = ref.affiliate_id AND af.status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped', 'affiliate_not_active'); END IF;

  SELECT count(*) INTO v_prev FROM public.bid_purchases p
    WHERE p.user_id = b.user_id AND p.payment_status = 'completed' AND p.id <> b.id;
  v_is_repurchase := (v_prev > 0);

  v_rate := CASE WHEN v_is_repurchase
                 THEN coalesce(a.repurchase_commission_rate, a.commission_rate)
                 ELSE a.commission_rate END;
  IF v_rate IS NULL OR v_rate <= 0 THEN RETURN jsonb_build_object('skipped', 'no_rate'); END IF;

  v_amount := round(b.amount_paid * v_rate / 100.0, 2);
  IF v_amount <= 0 THEN RETURN jsonb_build_object('skipped', 'zero_amount'); END IF;

  INSERT INTO public.affiliate_commissions
      (affiliate_id, purchase_id, referred_user_id, purchase_amount,
       commission_rate, commission_amount, status, is_repurchase, approved_at)
    VALUES (a.id, b.id, b.user_id, b.amount_paid,
            v_rate, v_amount, 'approved', v_is_repurchase, now());

  UPDATE public.affiliates
     SET commission_balance = coalesce(commission_balance, 0) + v_amount,
         total_commission_earned = coalesce(total_commission_earned, 0) + v_amount,
         total_conversions = coalesce(total_conversions, 0) + 1
   WHERE id = a.id;

  RETURN jsonb_build_object('created', true, 'affiliate_id', a.id,
                            'rate', v_rate, 'amount', v_amount,
                            'is_repurchase', v_is_repurchase);
END;
$fn$;

COMMENT ON FUNCTION public.ensure_affiliate_commission_for_purchase(uuid) IS
  'Cria a comissão de afiliado de uma compra concluída que ainda não tem comissão. Idempotente. Usada por gatilho em bid_purchases.';

CREATE OR REPLACE FUNCTION public.trg_ensure_affiliate_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF coalesce(NEW.payment_status, '') <> 'completed' THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.payment_status, '') = 'completed' THEN RETURN NULL; END IF;
  PERFORM public.ensure_affiliate_commission_for_purchase(NEW.id);
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_ensure_affiliate_commission ON public.bid_purchases;
CREATE TRIGGER trg_ensure_affiliate_commission
  AFTER INSERT OR UPDATE OF payment_status ON public.bid_purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_ensure_affiliate_commission();

-- Função interna: só o serviço (edge functions / rotinas) pode chamar.
REVOKE ALL ON FUNCTION public.ensure_affiliate_commission_for_purchase(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ensure_affiliate_commission() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_affiliate_commission_for_purchase(uuid) TO service_role;

-- =====================================================================
-- Reparo das duas comissões que não nasceram (compras pagas via MagenPay)
--   DNGG5A4D  <- Paulo     compra 9235486e  R$ 15,00  14/11/2026
--   CARLOS4A8C<- Carlos    compra 93ba95e9  R$ 15,00  05/11/2026
-- Ambas primeira compra do indicado: taxa atual do manager = 80% => R$ 12,00 cada.
-- =====================================================================

DO $do$
BEGIN
  PERFORM public.ensure_affiliate_commission_for_purchase('9235486e-0d04-4093-bb7f-c2ada2f2b078'::uuid);
  PERFORM public.ensure_affiliate_commission_for_purchase('93ba95e9-ca38-4ea9-b7e6-c88e95a307a1'::uuid);
END
$do$;

INSERT INTO public.admin_audit_log
    (admin_user_id, admin_name, action_type, target_type, target_id, description)
SELECT 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6'::uuid, 'Richard Lima',
       'affiliate_commission_backfill', 'affiliate_commission', c.id,
       'Comissão de primeira compra não registrada na confirmação MagenPay. Compra ' || c.purchase_id ||
       ' de R$ ' || to_char(c.purchase_amount, 'FM999990D00') || ' -> R$ ' ||
       to_char(c.commission_amount, 'FM999990D00') || ' (' || c.commission_rate || '%).'
FROM public.affiliate_commissions c
WHERE c.purchase_id IN ('9235486e-0d04-4093-bb7f-c2ada2f2b078'::uuid,
                        '93ba95e9-ca38-4ea9-b7e6-c88e95a307a1'::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.admin_audit_log l
                   WHERE l.target_id = c.id
                     AND l.action_type = 'affiliate_commission_backfill');