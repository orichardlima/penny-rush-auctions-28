DO $$
DECLARE
  v_ziel uuid := '75f2a82a-462b-4d50-ab30-d1602b73f470';
  v_ziel_c uuid := 'ff4c9227-9a8a-442b-91fe-4960cfc4cd04';
  v_eliel uuid := '1c6d44a4-a7c8-4501-86f0-85c24ce99d2b';
  v_eliel_c uuid := '9706be6b-580b-4497-8da0-fe68cc40446a';
  v_elielson uuid := '47f0bb38-a884-4a41-87f1-c6d10094d3e7';
  v_bonus uuid := '41f8f026-a6b8-4882-a872-34c271eeb518';
  v_now timestamptz := now();
  n int;
BEGIN
  IF (SELECT referred_by_user_id FROM partner_contracts WHERE id=v_ziel_c) <> v_elielson THEN
    RAISE EXCEPTION 'Estado inesperado do contrato';
  END IF;
  IF EXISTS (SELECT 1 FROM expansion_team_memberships WHERE ancestor_user_id=v_ziel AND effective_to IS NULL) THEN
    RAISE EXCEPTION 'Pessoa possui descendentes';
  END IF;

  UPDATE system_settings SET setting_value='true', updated_at=v_now WHERE setting_key='expansion_position_override_enabled';

  UPDATE partner_contracts SET referred_by_user_id=v_eliel WHERE id=v_ziel_c;

  -- encerra linhas antigas (histórico preservado)
  UPDATE expansion_team_memberships SET effective_to=v_now
   WHERE descendant_user_id=v_ziel AND effective_to IS NULL;

  -- nova linha ascendente: Eliel (1) + ascendentes do Eliel (+1)
  INSERT INTO expansion_team_memberships(ancestor_user_id,descendant_user_id,team_root_user_id,depth,descendant_contract_id,effective_from)
  VALUES (v_eliel, v_ziel, v_ziel, 1, v_ziel_c, v_now);
  INSERT INTO expansion_team_memberships(ancestor_user_id,descendant_user_id,team_root_user_id,depth,descendant_contract_id,effective_from)
  SELECT m.ancestor_user_id, v_ziel,
         CASE WHEN m.depth=1 THEN v_eliel ELSE m.team_root_user_id END,
         m.depth+1, v_ziel_c, v_now
    FROM expansion_team_memberships m
   WHERE m.descendant_user_id=v_eliel AND m.effective_to IS NULL;

  -- redireciona apenas o bônus de indicação direta R$ 79,84
  UPDATE partner_referral_bonuses SET referrer_contract_id=v_eliel_c
   WHERE id=v_bonus AND status='PENDING' AND referral_level=1 AND is_fast_start_bonus=false;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Bônus não redirecionado'; END IF;

  UPDATE system_settings SET setting_value='false', updated_at=now() WHERE setting_key='expansion_position_override_enabled';

  INSERT INTO admin_audit_log(admin_user_id,admin_name,action_type,target_type,target_id,description,old_values,new_values)
  VALUES ('c793d66c-06c5-4fdf-9c2c-0baedd2694f6','Administrador','network_position_exception','user',v_ziel,
   'Exceção administrativa autorizada por Richard Lima: Eliziel Lopes Pereira migrado da rede de Elielson Sales para a de Eliel Lopes Pereira (código 9FFEK844, já gravado no cadastro). Bônus direto R$ 79,84 redirecionado; Início Rápido R$ 9,98, demais bônus e 50 pontos preservados. Trava restaurada.',
   jsonb_build_object('sponsor',v_elielson,'bonus_referrer_contract','f6e8a9b0-f475-4921-9819-2474abbe61ed'),
   jsonb_build_object('sponsor',v_eliel,'bonus_referrer_contract',v_eliel_c,'bonus_id',v_bonus));
END $$;