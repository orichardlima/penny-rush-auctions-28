
-- 1. Backfill: corrigir managers existentes
UPDATE public.affiliates
SET 
  commission_rate = 50,
  repurchase_commission_rate = 20
WHERE role = 'manager' AND status = 'active';

-- 2. Backfill: corrigir influencers existentes
UPDATE public.affiliates
SET 
  commission_rate = 40,
  repurchase_commission_rate = 10
WHERE role = 'influencer' AND status = 'active';

-- 3. Função helper para obter as taxas vigentes de um afiliado (sempre do system_settings, baseado no role)
CREATE OR REPLACE FUNCTION public.get_affiliate_commission_rates(_affiliate_id uuid)
RETURNS TABLE(first_purchase_rate numeric, repurchase_rate numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_first numeric;
  v_repurchase numeric;
BEGIN
  SELECT role INTO v_role FROM public.affiliates WHERE id = _affiliate_id;

  IF v_role = 'manager' THEN
    SELECT setting_value::numeric INTO v_first FROM public.system_settings WHERE setting_key = 'affiliate_manager_commission_rate';
    SELECT setting_value::numeric INTO v_repurchase FROM public.system_settings WHERE setting_key = 'affiliate_manager_repurchase_rate';
  ELSIF v_role = 'influencer' THEN
    SELECT setting_value::numeric INTO v_first FROM public.system_settings WHERE setting_key = 'affiliate_influencer_commission_rate';
    SELECT setting_value::numeric INTO v_repurchase FROM public.system_settings WHERE setting_key = 'affiliate_influencer_repurchase_rate';
  ELSE
    SELECT setting_value::numeric INTO v_first FROM public.system_settings WHERE setting_key = 'affiliate_default_commission_rate';
    SELECT setting_value::numeric INTO v_repurchase FROM public.system_settings WHERE setting_key = 'affiliate_repurchase_commission_rate';
  END IF;

  RETURN QUERY SELECT COALESCE(v_first, 10), COALESCE(v_repurchase, 5);
END;
$$;

-- 4. Trigger: ao mudar o setting no painel admin, propaga para todos os afiliados do role correspondente
CREATE OR REPLACE FUNCTION public.sync_affiliate_rates_on_setting_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value numeric;
BEGIN
  v_value := NEW.setting_value::numeric;

  IF NEW.setting_key = 'affiliate_manager_commission_rate' THEN
    UPDATE public.affiliates SET commission_rate = v_value WHERE role = 'manager' AND status = 'active';
  ELSIF NEW.setting_key = 'affiliate_manager_repurchase_rate' THEN
    UPDATE public.affiliates SET repurchase_commission_rate = v_value WHERE role = 'manager' AND status = 'active';
  ELSIF NEW.setting_key = 'affiliate_influencer_commission_rate' THEN
    UPDATE public.affiliates SET commission_rate = v_value WHERE role = 'influencer' AND status = 'active';
  ELSIF NEW.setting_key = 'affiliate_influencer_repurchase_rate' THEN
    UPDATE public.affiliates SET repurchase_commission_rate = v_value WHERE role = 'influencer' AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_affiliate_rates ON public.system_settings;
CREATE TRIGGER trg_sync_affiliate_rates
AFTER UPDATE OF setting_value ON public.system_settings
FOR EACH ROW
WHEN (NEW.setting_key IN (
  'affiliate_manager_commission_rate',
  'affiliate_manager_repurchase_rate',
  'affiliate_influencer_commission_rate',
  'affiliate_influencer_repurchase_rate'
))
EXECUTE FUNCTION public.sync_affiliate_rates_on_setting_change();
