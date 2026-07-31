
-- 0) chave de exceção (desligada): apenas rotina futura de superadmin poderá usá-la
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('expansion_position_override_enabled', 'false',
        'Exceção de superadmin para correção cadastral de posição na rede. Deve permanecer false.')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.expansion_position_override_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT setting_value FROM public.system_settings
                    WHERE setting_key = 'expansion_position_override_enabled') = 'true', false)
$$;

-- 1) posição definitiva: bloqueia troca de patrocinador no contrato
CREATE OR REPLACE FUNCTION public.expansion_block_sponsor_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referred_by_user_id IS DISTINCT FROM OLD.referred_by_user_id
     AND NOT public.expansion_position_override_active() THEN
    RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
  END IF;
  RETURN NEW;
END; $$;

-- 2) posição definitiva: bloqueia troca do código de indicação do perfil após ter contrato
CREATE OR REPLACE FUNCTION public.expansion_block_profile_referral_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referred_by_partner_code IS DISTINCT FROM OLD.referred_by_partner_code
     AND NOT public.expansion_position_override_active()
     AND EXISTS (SELECT 1 FROM public.partner_contracts pc WHERE pc.user_id = OLD.user_id) THEN
    RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_expansion_block_profile_referral_change ON public.profiles;
CREATE TRIGGER trg_expansion_block_profile_referral_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.expansion_block_profile_referral_change();

-- 3) memberships: imutáveis (sem DELETE e sem encerramento em operação normal)
CREATE OR REPLACE FUNCTION public.expansion_block_membership_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.expansion_position_override_active() THEN
    RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
  END IF;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.expansion_block_membership_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.expansion_position_override_active() THEN
    RETURN NEW;
  END IF;
  IF NEW.ancestor_user_id IS DISTINCT FROM OLD.ancestor_user_id
     OR NEW.descendant_user_id IS DISTINCT FROM OLD.descendant_user_id
     OR NEW.team_root_user_id IS DISTINCT FROM OLD.team_root_user_id
     OR NEW.depth IS DISTINCT FROM OLD.depth
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
    RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
  END IF;
  RETURN NEW;
END; $$;

-- 4) recomputação: passa a ser apenas aditiva (nunca encerra vínculos existentes)
CREATE OR REPLACE FUNCTION public.expansion_recompute_memberships(_contract_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID; v_referrer UUID; v_ancestor UUID; v_prev UUID;
  v_depth INT := 0; v_inserted INT := 0; v_now TIMESTAMPTZ := now();
  v_chain JSONB := '[]'::jsonb;
BEGIN
  SELECT user_id, referred_by_user_id INTO v_user, v_referrer
  FROM public.partner_contracts WHERE id = _contract_id;
  IF v_user IS NULL THEN RETURN 0; END IF;

  IF v_referrer IS NOT NULL THEN
    v_prev := v_user;
    v_ancestor := v_referrer;
    WHILE v_ancestor IS NOT NULL LOOP
      v_depth := v_depth + 1;
      v_chain := v_chain || jsonb_build_object('ancestor', v_ancestor, 'team_root', v_prev, 'depth', v_depth);
      EXIT WHEN v_depth > 50;
      v_prev := v_ancestor;
      SELECT referred_by_user_id INTO v_ancestor
        FROM public.partner_contracts
       WHERE user_id = v_ancestor AND status='ACTIVE'
       ORDER BY created_at ASC LIMIT 1;
    END LOOP;
  END IF;

  -- somente aditivo: posição existente é permanente, nada é encerrado ou removido
  INSERT INTO public.expansion_team_memberships
    (ancestor_user_id, descendant_user_id, team_root_user_id, depth, descendant_contract_id, effective_from)
  SELECT (c->>'ancestor')::uuid, v_user, (c->>'team_root')::uuid, (c->>'depth')::int, _contract_id, v_now
    FROM jsonb_array_elements(v_chain) c
   WHERE NOT EXISTS (
     SELECT 1 FROM public.expansion_team_memberships m
      WHERE m.descendant_user_id = v_user
        AND m.ancestor_user_id = (c->>'ancestor')::uuid
        AND m.effective_to IS NULL
   );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN v_inserted;
END; $$;

-- 5) rotinas de saída/troca desativadas (assinaturas mantidas)
CREATE OR REPLACE FUNCTION public.partner_request_leave_sponsor(p_contract_id uuid, p_reason text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
END; $$;

CREATE OR REPLACE FUNCTION public.partner_leave_sponsor_network(p_contract_id uuid, p_reason text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
END; $$;

CREATE OR REPLACE FUNCTION public.partner_choose_new_sponsor(p_contract_id uuid, p_new_sponsor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
END; $$;

CREATE OR REPLACE FUNCTION public.admin_transfer_partner_sponsor(
  p_contract_id uuid, p_new_sponsor_user_id uuid, p_cancel_pending_bonuses boolean DEFAULT true,
  p_reverse_available_bonuses boolean DEFAULT false, p_remove_from_binary boolean DEFAULT false,
  p_reason text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'A posição na rede é definitiva e não pode ser alterada após o cadastro.';
END; $$;

CREATE OR REPLACE FUNCTION public.partner_process_expired_network_exits()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object('success', true, 'disabled', true, 'processed', 0);
END; $$;

CREATE OR REPLACE FUNCTION public.partner_send_network_exit_reminders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN jsonb_build_object('success', true, 'disabled', true, 'sent', 0);
END; $$;

REVOKE EXECUTE ON FUNCTION public.partner_request_leave_sponsor(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_leave_sponsor_network(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_choose_new_sponsor(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_transfer_partner_sponsor(uuid, uuid, boolean, boolean, boolean, text) FROM anon, authenticated;

-- 6) desliga crons de saída de rede
DO $$
BEGIN
  PERFORM cron.unschedule('partner_network_exit_expiry');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('partner-network-exit-reminders');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
