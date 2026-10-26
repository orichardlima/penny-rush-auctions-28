CREATE OR REPLACE FUNCTION public._profile_data_complete(p public.profiles)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT coalesce(regexp_replace(p.cpf,'\D','','g') ~ '^\d{11}$', false)
     AND length(coalesce(trim(p.phone),'')) >= 10
     AND length(coalesce(nullif(trim(p.cep),''), trim(p.address_zip),'')) >= 8
     AND coalesce(nullif(trim(p.street),''), nullif(trim(p.address_street),'')) IS NOT NULL
     AND coalesce(nullif(trim(p.city),''), nullif(trim(p.address_city),'')) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF coalesce(current_setting('role', true),'') <> 'service_role'
     AND coalesce(current_setting('app.allow_sensitive_profile_update', true), '') <> 'true'
     AND NOT is_admin_user(auth.uid())
  THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.blocked_at := OLD.blocked_at;
    NEW.blocked_by := OLD.blocked_by;
    NEW.block_reason := OLD.block_reason;
    NEW.bids_balance := OLD.bids_balance;
    NEW.is_bot := OLD.is_bot;
    NEW.is_test_account := OLD.is_test_account;
    NEW.signup_bonus_received := OLD.signup_bonus_received;
    NEW.signup_bonus_amount := OLD.signup_bonus_amount;
    NEW.signup_bonus_date := OLD.signup_bonus_date;
    IF OLD.cpf IS NOT NULL AND trim(OLD.cpf) <> '' THEN
      NEW.cpf := OLD.cpf;
    END IF;
    -- só pode virar completo se os dados estiverem realmente preenchidos
    NEW.profile_complete := coalesce(OLD.profile_complete,false) OR public._profile_data_complete(NEW);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_insert_completeness()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF coalesce(NEW.is_bot,false) = false AND NOT public._profile_data_complete(NEW) THEN
    NEW.profile_complete := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_profile_insert_completeness ON public.profiles;
CREATE TRIGGER trg_profile_insert_completeness BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profile_insert_completeness();

CREATE OR REPLACE FUNCTION public.require_complete_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p
             WHERE p.user_id = NEW.user_id
               AND coalesce(p.is_bot,false) = false
               AND coalesce(p.is_admin,false) = false
               AND (coalesce(p.profile_complete,false) = false OR coalesce(p.is_blocked,false) = true)) THEN
    RAISE EXCEPTION 'Complete seu cadastro (CPF e endereço) antes de continuar.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_complete_profile() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_bids_require_complete_profile ON public.bids;
CREATE TRIGGER trg_bids_require_complete_profile BEFORE INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile();