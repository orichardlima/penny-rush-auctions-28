DO $$
DECLARE
  v_contract uuid := '5a3833c8-2152-4090-b707-b590b92f08a9';
  v_referrer uuid := '18c062cb-1bd6-4889-b20f-c359da2f5971';
  v_prev text;
BEGIN
  SELECT setting_value INTO v_prev FROM public.system_settings WHERE setting_key = 'expansion_position_override_enabled';

  INSERT INTO public.system_settings (setting_key, setting_value)
  VALUES ('expansion_position_override_enabled', 'true')
  ON CONFLICT (setting_key) DO UPDATE SET setting_value = 'true';

  UPDATE public.partner_contracts
  SET referred_by_user_id = v_referrer, updated_at = now()
  WHERE id = v_contract AND referred_by_user_id IS NULL;

  IF v_prev IS NULL THEN
    DELETE FROM public.system_settings WHERE setting_key = 'expansion_position_override_enabled';
  ELSE
    UPDATE public.system_settings SET setting_value = v_prev WHERE setting_key = 'expansion_position_override_enabled';
  END IF;
END $$;