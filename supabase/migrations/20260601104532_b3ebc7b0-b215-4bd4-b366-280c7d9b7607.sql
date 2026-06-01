
-- 1) Cancelar bônus de indicação pré-cadastro da Géssica (cutoff: 2026-05-11 14:22:36+00)
UPDATE public.partner_referral_bonuses
SET status = 'CANCELLED',
    source_event = COALESCE(source_event, '') || ' | pre_cutoff_skip:2026-05-11'
WHERE status = 'AVAILABLE'
  AND created_at < '2026-05-11 14:22:36+00';

-- 2) Registrar a data de corte em system_settings
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES (
  'referral_bonus_cutoff_date',
  '2026-05-11T14:22:36+00:00',
  'string',
  'Data de corte do recálculo do bônus de indicação. Bônus criados ou referentes a contratos anteriores a esta data não entram no saldo.'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description   = EXCLUDED.description,
    updated_at    = now();

-- 3) Trigger BEFORE INSERT que impede ressurgir bônus pré-corte
CREATE OR REPLACE FUNCTION public.enforce_referral_bonus_cutoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
  v_referred_created timestamptz;
BEGIN
  SELECT setting_value::timestamptz INTO v_cutoff
  FROM public.system_settings
  WHERE setting_key = 'referral_bonus_cutoff_date'
  LIMIT 1;

  IF v_cutoff IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_at INTO v_referred_created
  FROM public.partner_contracts
  WHERE id = NEW.referred_contract_id;

  IF COALESCE(NEW.created_at, now()) < v_cutoff
     OR (v_referred_created IS NOT NULL AND v_referred_created < v_cutoff) THEN
    NEW.status := 'CANCELLED';
    NEW.source_event := COALESCE(NEW.source_event, '') || ' | pre_cutoff_skip';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_referral_bonus_cutoff ON public.partner_referral_bonuses;
CREATE TRIGGER trg_enforce_referral_bonus_cutoff
BEFORE INSERT ON public.partner_referral_bonuses
FOR EACH ROW
EXECUTE FUNCTION public.enforce_referral_bonus_cutoff();
