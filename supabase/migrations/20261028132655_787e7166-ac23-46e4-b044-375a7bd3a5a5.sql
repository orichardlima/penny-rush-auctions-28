-- Exact signatures checked against production catalog, including trigger-only clicks().
DO $contain$
DECLARE r record; target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['close_binary_cycle','points_reserve','points_confirm_reservation','points_release_reservation','process_partner_referral_bonus','fix_partner_referral','expansion_reverse_contract','consume_bid_lots','commit_bid_lot_consumptions','consume_bid_lots_for_bid','position_partner_binary','increment_affiliate_conversions','increment_affiliate_clicks','fury_vault_distribute','notify_user','release_pending_referral_bonuses','expire_suspended_bonuses','points_settle_pending_auctions','expansion_credit_contract_activation','expansion_credit_upgrade'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=target) THEN RAISE EXCEPTION 'Missing expected function %', target; END IF;
    FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=target LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',r.signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
    END LOOP;
  END LOOP;
END $contain$;

-- Do not use current_user inside a SECURITY DEFINER trigger: it is the owner.
CREATE OR REPLACE FUNCTION public.require_complete_profile_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_blocked boolean; v_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    IF coalesce(current_setting('role',true),'none') IN ('service_role','none','postgres','supabase_admin') AND session_user IN ('postgres','supabase_admin','authenticator','service_role') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501';
  END IF;
  SELECT profile_complete,coalesce(is_blocked,false),coalesce(is_admin,false) INTO v_ok,v_blocked,v_admin FROM public.profiles WHERE user_id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado' USING ERRCODE='42501'; END IF;
  IF v_blocked THEN RAISE EXCEPTION 'Conta bloqueada' USING ERRCODE='42501'; END IF;
  IF v_admin THEN RETURN NEW; END IF;
  IF NOT coalesce(v_ok,false) THEN RAISE EXCEPTION 'Complete seu cadastro (CPF e endereço) antes de continuar' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.require_complete_profile_generic() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.require_complete_profile_generic() TO service_role;

-- Preserve administrative RPC signatures; validate the authenticated actor rather than a supplied admin UUID.
DO $guards$
DECLARE name text; oid_value oid; def text; old_guard text := 'IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION ''not_admin''; END IF;';
BEGIN
 FOREACH name IN ARRAY ARRAY['redeem_approve','redeem_reject'] LOOP
  oid_value := to_regprocedure(format('public.%I(uuid,uuid,text)',name));
  SELECT pg_get_functiondef(oid_value) INTO def;
  IF position(old_guard IN def)=0 THEN RAISE EXCEPTION 'Unexpected definition for %',name; END IF;
  def := replace(def,old_guard,'IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_admin_user(auth.uid()) OR p_admin IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501''; END IF;
  ELSIF coalesce(current_setting(''role'',true),''none'') NOT IN (''service_role'',''none'',''postgres'',''supabase_admin'') OR session_user NOT IN (''postgres'',''supabase_admin'',''authenticator'',''service_role'') THEN
    RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501'';
  END IF;
  IF NOT public.is_admin_user(p_admin) THEN RAISE EXCEPTION ''not_admin'' USING ERRCODE=''42501''; END IF;');
  EXECUTE def;
 END LOOP;
END $guards$;
REVOKE EXECUTE ON FUNCTION public.redeem_approve(uuid,uuid,text),public.redeem_reject(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.redeem_approve(uuid,uuid,text),public.redeem_reject(uuid,uuid,text) TO authenticated,service_role;

-- GLOBAL PUBLIC privilege must also be removed; schema-level revokes alone are insufficient.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $assert$
DECLARE r record;
BEGIN
 FOR r IN SELECT p.oid,p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY(ARRAY['close_binary_cycle','points_reserve','points_confirm_reservation','points_release_reservation','process_partner_referral_bonus','fix_partner_referral','expansion_reverse_contract','consume_bid_lots','commit_bid_lot_consumptions','consume_bid_lots_for_bid','position_partner_binary','increment_affiliate_conversions','increment_affiliate_clicks','fury_vault_distribute','notify_user','release_pending_referral_bonuses','expire_suspended_bonuses','points_settle_pending_auctions','expansion_credit_contract_activation','expansion_credit_upgrade']) LOOP
  IF has_function_privilege('authenticated',r.oid,'EXECUTE') OR has_function_privilege('anon',r.oid,'EXECUTE') OR NOT has_function_privilege('service_role',r.oid,'EXECUTE') THEN RAISE EXCEPTION 'ACL regression %',r.signature; END IF;
 END LOOP;
END $assert$;