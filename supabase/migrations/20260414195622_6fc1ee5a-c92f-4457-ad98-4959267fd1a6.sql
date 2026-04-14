ALTER TABLE public.partner_referral_bonuses DISABLE TRIGGER trg_check_fast_start;

INSERT INTO public.partner_referral_bonuses (
  referrer_contract_id,
  referred_contract_id,
  referred_user_id,
  referral_level,
  aporte_value,
  bonus_percentage,
  bonus_value,
  is_fast_start_bonus,
  source_event,
  status,
  available_at
) VALUES (
  'be3406be-0248-439f-84cb-77a85d344867',
  '1ab45a69-ca8b-437e-9fd8-9b0ae1451986',
  (SELECT user_id FROM partner_contracts WHERE id = '1ab45a69-ca8b-437e-9fd8-9b0ae1451986'),
  1,
  15001,
  16,
  2400.16,
  false,
  'upgrade',
  'PENDING',
  now() + interval '7 days'
);

ALTER TABLE public.partner_referral_bonuses ENABLE TRIGGER trg_check_fast_start;