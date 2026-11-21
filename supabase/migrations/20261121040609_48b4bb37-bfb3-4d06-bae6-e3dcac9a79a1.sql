DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.fast_start_achievements
    WHERE id = '1eaf44f0-cf9a-4f64-8e7f-75d8efd899d9'
      AND partner_contract_id = 'd4565839-59a3-4fb3-b86e-d3f40f905762'
      AND processed = true
      AND total_extra_bonus = 89.94
  ) THEN
    RAISE EXCEPTION 'Resumo de Início Rápido original não confirmado';
  END IF;

  IF (
    SELECT COUNT(*) FROM public.partner_referral_bonuses
    WHERE id IN (
      'a58a2afa-9f73-46fb-9f05-2273ea7137d0',
      '549badb0-1776-48c4-82b1-eee1cc634ce7',
      '7883c0d1-545a-4aef-a82e-827d308cff6e'
    ) AND status = 'CANCELLED'
      AND cancellation_reason = 'AUTHORIZED_PENDING_FAST_START_CANCELLATION_2026_11_21'
  ) <> 3 THEN
    RAISE EXCEPTION 'Os três cancelamentos autorizados não foram confirmados';
  END IF;
END;
$$;

INSERT INTO public.admin_audit_log (
  admin_user_id, admin_name, action_type, target_type, target_id,
  old_values, new_values, description
)
SELECT
  'c793d66c-06c5-4fdf-9c2c-0baedd2694f6',
  'Richard Lima',
  'FAST_START_CANCELLED_TOTAL_ALIGNED',
  'fast_start_achievement',
  '1eaf44f0-cf9a-4f64-8e7f-75d8efd899d9',
  jsonb_build_object('total_extra_bonus', 89.94, 'processed', true),
  jsonb_build_object('total_extra_bonus', 0, 'processed', true),
  'Resumo zerado em 21/11/2026 após o cancelamento autorizado dos 3 adicionais pendentes de R$ 89,94; nenhum crédito ou saldo alterado.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_audit_log
  WHERE action_type = 'FAST_START_CANCELLED_TOTAL_ALIGNED'
    AND target_type = 'fast_start_achievement'
    AND target_id = '1eaf44f0-cf9a-4f64-8e7f-75d8efd899d9'
);

UPDATE public.fast_start_achievements
SET total_extra_bonus = 0
WHERE id = '1eaf44f0-cf9a-4f64-8e7f-75d8efd899d9'
  AND processed = true
  AND total_extra_bonus = 89.94;