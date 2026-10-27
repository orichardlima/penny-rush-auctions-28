CREATE OR REPLACE FUNCTION public.require_complete_profile_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid; v_ok boolean; v_blocked boolean; v_admin boolean;
BEGIN
  IF current_user IN ('postgres','service_role','supabase_admin') OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  v_uid := auth.uid();
  SELECT profile_complete, coalesce(is_blocked,false), coalesce(is_admin,false) INTO v_ok, v_blocked, v_admin FROM profiles WHERE user_id=v_uid;
  IF v_admin THEN RETURN NEW; END IF;
  IF v_blocked THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;
  IF coalesce(v_ok,false)=false THEN RAISE EXCEPTION 'Complete seu cadastro (CPF e endereço) antes de continuar'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.require_complete_profile_generic() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_req_complete_pw ON public.partner_withdrawals;
CREATE TRIGGER trg_req_complete_pw BEFORE INSERT ON public.partner_withdrawals FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile_generic();
DROP TRIGGER IF EXISTS trg_req_complete_aw ON public.affiliate_withdrawals;
CREATE TRIGGER trg_req_complete_aw BEFORE INSERT ON public.affiliate_withdrawals FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile_generic();
DROP TRIGGER IF EXISTS trg_req_complete_fw ON public.fury_vault_withdrawals;
CREATE TRIGGER trg_req_complete_fw BEFORE INSERT ON public.fury_vault_withdrawals FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile_generic();
DROP TRIGGER IF EXISTS trg_req_complete_bp ON public.bid_purchases;
CREATE TRIGGER trg_req_complete_bp BEFORE INSERT ON public.bid_purchases FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile_generic();
DROP TRIGGER IF EXISTS trg_req_complete_ppi ON public.partner_payment_intents;
CREATE TRIGGER trg_req_complete_ppi BEFORE INSERT ON public.partner_payment_intents FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile_generic();

-- Re-bloquear contas atacantes (bloqueio anterior havia sido revertido)
UPDATE public.profiles SET is_blocked=true, profile_complete=false, blocked_at=coalesce(blocked_at,now()),
  block_reason='Fraude: cadastro criado fora do site sem CPF/endereço (26/10)'
WHERE email ilike '%@mailnull.com' OR email ilike 'xbtsp2abnzz@%' OR email ilike '%audit.qa%';

-- Impedir login dessas contas
UPDATE auth.users SET banned_until='2999-01-01'
WHERE id IN (SELECT user_id FROM public.profiles WHERE block_reason='Fraude: cadastro criado fora do site sem CPF/endereço (26/10)');