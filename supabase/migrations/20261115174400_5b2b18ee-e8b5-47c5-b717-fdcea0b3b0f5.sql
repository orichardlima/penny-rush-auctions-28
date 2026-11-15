-- =====================================================================
-- Correção: a comissão estava sendo creditada duas vezes no saldo.
-- update_affiliate_stats_trigger (AFTER INSERT OR UPDATE OF status em
-- affiliate_commissions) já credita commission_balance e
-- total_commission_earned quando a comissão nasce 'approved'.
-- A função criada hoje creditava de novo manualmente.
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

  -- O crédito em commission_balance / total_commission_earned é feito pelo
  -- trigger update_affiliate_stats_trigger ao inserir a comissão como 'approved'.
  -- Aqui entra apenas a comissão e a contagem de conversão.
  INSERT INTO public.affiliate_commissions
      (affiliate_id, purchase_id, referred_user_id, purchase_amount,
       commission_rate, commission_amount, status, is_repurchase, approved_at)
    VALUES (a.id, b.id, b.user_id, b.amount_paid,
            v_rate, v_amount, 'approved', v_is_repurchase, now());

  UPDATE public.affiliates
     SET total_conversions = coalesce(total_conversions, 0) + 1
   WHERE id = a.id;

  RETURN jsonb_build_object('created', true, 'affiliate_id', a.id,
                            'rate', v_rate, 'amount', v_amount,
                            'is_repurchase', v_is_repurchase);
END;
$fn$;

COMMENT ON FUNCTION public.ensure_affiliate_commission_for_purchase(uuid) IS
  'Cria a comissão de afiliado de uma compra concluída que ainda não tem comissão. Idempotente. O crédito do saldo é do trigger update_affiliate_stats_trigger.';

-- Devolver ao saldo dos dois afiliados o valor creditado em excesso.
UPDATE public.affiliates
   SET commission_balance = commission_balance - 12.00,
       total_commission_earned = total_commission_earned - 12.00
 WHERE id IN ('b771235f-1576-4d50-931c-5d8823dccac7', '5c45884e-6f7a-42de-b544-950a72c68801')
   AND commission_balance = 24.00
   AND total_commission_earned = 24.00;

INSERT INTO public.admin_audit_log
    (admin_user_id, admin_name, action_type, target_type, target_id, description)
SELECT 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6'::uuid, 'Richard Lima',
       'affiliate_commission_correction', 'affiliate', af.id,
       'Estorno de R$ 12,00 creditados em dobro pela função de recomposição de comissão. ' ||
       'Saldo corrigido de R$ 24,00 para R$ 12,00 (comissão correta: primeira compra de R$ 15,00 a 80%).'
FROM public.affiliates af
WHERE af.id IN ('b771235f-1576-4d50-931c-5d8823dccac7', '5c45884e-6f7a-42de-b544-950a72c68801')
  AND af.commission_balance = 12.00
  AND NOT EXISTS (SELECT 1 FROM public.admin_audit_log l
                   WHERE l.target_id = af.id
                     AND l.action_type = 'affiliate_commission_correction');