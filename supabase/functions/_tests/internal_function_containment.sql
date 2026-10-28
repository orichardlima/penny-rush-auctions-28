-- Run through the migration tool on this project. All fixture writes are
-- rolled back by the caught subtransaction exception; no external calls.
DO $tests$
DECLARE r record; args text; caught boolean; msg text; a uuid;
  u uuid := '18c062cb-1bd6-4889-b20f-c359da2f5971';
  aff uuid := '8406092b-4e52-40ac-b439-e3b172584633';
  admin_id uuid := 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6';
  red uuid; wallet_before bigint; pass_count integer := 0;
BEGIN
  FOR r IN SELECT p.oid,p.oid::regprocedure sig,p.prorettype,p.proargtypes
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(ARRAY[
      'close_binary_cycle','points_reserve','points_confirm_reservation','points_release_reservation',
      'process_partner_referral_bonus','fix_partner_referral','expansion_reverse_contract',
      'consume_bid_lots','commit_bid_lot_consumptions','consume_bid_lots_for_bid',
      'position_partner_binary','increment_affiliate_conversions','increment_affiliate_clicks',
      'fury_vault_distribute','fury_vault_on_bid','notify_user','release_pending_referral_bonuses',
      'expire_suspended_bonuses','points_settle_pending_auctions',
      'expansion_credit_contract_activation','expansion_credit_upgrade']) LOOP
    IF has_function_privilege('authenticated',r.oid,'EXECUTE') OR has_function_privilege('anon',r.oid,'EXECUTE')
       OR NOT has_function_privilege('service_role',r.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL ACL %',r.sig;
    END IF;
    IF r.prorettype <> 'trigger'::regtype THEN
      SELECT string_agg('NULL::'||format_type(t,NULL),',') INTO args FROM unnest(r.proargtypes::oid[]) t;
      caught := false;
      PERFORM set_config('request.jwt.claim.sub',u::text,true);
      PERFORM set_config('role','authenticated',true);
      BEGIN
        EXECUTE format('SELECT public.%I(%s)',split_part(r.sig::text,'(',1),coalesce(args,''));
      EXCEPTION WHEN insufficient_privilege THEN caught := true;
      END;
      PERFORM set_config('role','none',true);
      IF NOT caught THEN RAISE EXCEPTION 'FAIL execution %',r.sig; END IF;
    END IF;
    pass_count := pass_count+1;
  END LOOP;
  IF pass_count<>22 THEN RAISE EXCEPTION 'FAIL expected 22 signatures got %',pass_count; END IF;
  RAISE NOTICE 'PASS internal ACLs and authenticated execution: % signatures',pass_count;

  -- A real owner-policy-authorized INSERT, not a direct trigger call.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub','',true);
    PERFORM set_config('app.allow_sensitive_profile_update','true',true);
    UPDATE public.profiles SET profile_complete=false,is_blocked=false WHERE user_id=u;
    IF NOT FOUND THEN RAISE EXCEPTION 'Missing affiliate fixture'; END IF;
    PERFORM set_config('request.jwt.claim.sub',u::text,true);
    PERFORM set_config('role','authenticated',true);
    IF NOT EXISTS(SELECT 1 FROM public.affiliates WHERE id=aff AND user_id=auth.uid()) THEN
      RAISE EXCEPTION 'Owner-policy fixture not visible';
    END IF;
    caught := false;
    BEGIN
      INSERT INTO public.affiliate_withdrawals(affiliate_id,amount,payment_method,payment_details)
        VALUES(aff,1,'pix','{}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN
      GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
      caught := msg='Complete seu cadastro (CPF e endereço) antes de continuar';
    END;
    IF NOT caught THEN RAISE EXCEPTION 'FAIL incomplete profile trigger'; END IF;
    PERFORM set_config('role','none',true);
    PERFORM set_config('request.jwt.claim.sub','',true);
    UPDATE public.profiles SET profile_complete=true WHERE user_id=u;
    PERFORM set_config('request.jwt.claim.sub',u::text,true);
    PERFORM set_config('role','authenticated',true);
    INSERT INTO public.affiliate_withdrawals(affiliate_id,amount,payment_method,payment_details)
      VALUES(aff,1,'pix','{}'::jsonb);
    PERFORM set_config('role','none',true);
    RAISE EXCEPTION 'ROLLBACK_PROFILE_PASS';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
    IF msg<>'ROLLBACK_PROFILE_PASS' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS incomplete profile blocked and complete owner INSERT allowed; fixtures rolled back';

  -- Ordinary caller cannot supply the UUID of a real administrator.
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('role','authenticated',true);
  caught := false;
  BEGIN
    PERFORM public.points_admin_adjust(u,1,'containment test',admin_id,'containment-test');
  EXCEPTION WHEN insufficient_privilege THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'FAIL admin impersonation'; END IF;
  caught := false;
  BEGIN
    PERFORM public.redeem_approve(gen_random_uuid(),admin_id,'containment test');
  EXCEPTION WHEN insufficient_privilege THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'FAIL redemption impersonation'; END IF;
  PERFORM set_config('role','none',true);
  RAISE NOTICE 'PASS administrator impersonation rejected';

  -- Authorized admin adjustment -> customer redemption -> cancellation.
  BEGIN
    PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
    PERFORM set_config('role','authenticated',true);
    PERFORM public.points_admin_adjust(u,150,'rollback regression',admin_id,gen_random_uuid()::text);
    PERFORM set_config('request.jwt.claim.sub',u::text,true);
    SELECT available_points INTO wallet_before FROM public.points_wallets WHERE user_id=u;
    red := public.redeem_create('[{"item_id":"64f03dd4-7ec5-4f7e-81cb-9d199b56a853","quantity":1}]'::jsonb,'{}'::jsonb,gen_random_uuid()::text);
    IF (SELECT available_points FROM public.points_wallets WHERE user_id=u) <> wallet_before-150 THEN RAISE EXCEPTION 'FAIL reserve'; END IF;
    PERFORM public.redeem_cancel(red,'rollback regression');
    IF (SELECT available_points FROM public.points_wallets WHERE user_id=u) <> wallet_before THEN RAISE EXCEPTION 'FAIL release'; END IF;
    PERFORM set_config('role','none',true);
    RAISE EXCEPTION 'ROLLBACK_STORE_PASS';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
    IF msg<>'ROLLBACK_STORE_PASS' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS authorized admin adjustment and customer reserve/cancel; fixtures rolled back';
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('role','none',true);
END $tests$;