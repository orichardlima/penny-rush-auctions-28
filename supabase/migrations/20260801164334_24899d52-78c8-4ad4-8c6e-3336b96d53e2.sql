
CREATE OR REPLACE FUNCTION public.expansion_part3_selftest()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  R uuid := '18c062cb-1bd6-4889-b20f-c359da2f5971';
  T_ED uuid := 'b47000b8-6c58-4f9b-8983-4d11c7a60284';
  T_ED2 uuid := '764735fe-815c-44d0-afa9-f593846b0c77';
  T_AL uuid := '3b6afdf7-b243-4236-aafe-092811110823';
  out jsonb := '{}'::jsonb;
  v numeric; n int; d int;
BEGIN
  BEGIN
    -- T1 Richard: contaveis Bronze
    SELECT sum(LEAST(t.net_career_points, 1000*0.70)) INTO v
      FROM public.expansion_career_points_by_team(R) t WHERE t.net_career_points > 0;
    out := out || jsonb_build_object('t1_richard_bronze_countable', v, 't1_qualifica', v >= 1000);
    -- Prata
    SELECT sum(LEAST(t.net_career_points, 4000*0.60)) INTO v
      FROM public.expansion_career_points_by_team(R) t WHERE t.net_career_points > 0;
    out := out || jsonb_build_object('t1_richard_prata_countable', v, 't1_prata_qualifica', v >= 4000);

    -- T2 Bronze valido (600 + 600, teto 700)
    v := LEAST(600,700) + LEAST(600,700);
    out := out || jsonb_build_object('t2_bronze_countable', v, 't2_qualifica', v >= 1000);
    -- T3 equipe unica 5000
    v := LEAST(5000,700);
    out := out || jsonb_build_object('t3_uma_equipe_countable', v, 't3_qualifica', v >= 1000);

    -- Lideres: nenhum rank oficial ainda
    SELECT count(*) INTO n FROM public.expansion_eligible_leaders(R,'BRONZE');
    out := out || jsonb_build_object('t4_lideres_bronze_atual', n);

    -- T5: lider OURO oficial satisfaz BRONZE
    INSERT INTO public.expansion_partner_ranks(user_id,current_rank,highest_rank_ever)
      VALUES (T_ED,'OURO','OURO');
    SELECT count(*) INTO n FROM public.expansion_eligible_leaders(R,'BRONZE');
    out := out || jsonb_build_object('t5_ouro_satisfaz_bronze', n);

    -- T6: highest OURO mas current NONE nao conta
    UPDATE public.expansion_partner_ranks SET current_rank='NONE' WHERE user_id=T_ED;
    SELECT count(*) INTO n FROM public.expansion_eligible_leaders(R,'BRONZE');
    out := out || jsonb_build_object('t6_highest_only_conta', n,
      't6_highest_preservado', (SELECT highest_rank_ever FROM public.expansion_partner_ranks WHERE user_id=T_ED));

    -- T7: dois PRATA na mesma equipe
    UPDATE public.expansion_partner_ranks SET current_rank='PRATA' WHERE user_id=T_ED;
    INSERT INTO public.expansion_partner_ranks(user_id,current_rank,highest_rank_ever)
      VALUES (T_ED2,'PRATA','PRATA');
    SELECT count(*), count(DISTINCT team_root_user_id) INTO n,d
      FROM public.expansion_eligible_leaders(R,'PRATA');
    out := out || jsonb_build_object('t7_lideres',n,'t7_equipes_distintas',d,'t7_atende_ouro', d>=2);

    -- T8: dois PRATA em equipes distintas
    DELETE FROM public.expansion_partner_ranks WHERE user_id=T_ED2;
    INSERT INTO public.expansion_partner_ranks(user_id,current_rank,highest_rank_ever)
      VALUES (T_AL,'PRATA','PRATA');
    SELECT count(*), count(DISTINCT team_root_user_id) INTO n,d
      FROM public.expansion_eligible_leaders(R,'PRATA');
    out := out || jsonb_build_object('t8_lideres',n,'t8_equipes_distintas',d,'t8_atende_ouro', d>=2);

    -- T9 guarda highest_rank_ever nao diminui
    BEGIN
      UPDATE public.expansion_partner_ranks SET highest_rank_ever='NONE' WHERE user_id=T_AL;
      out := out || jsonb_build_object('t9_guard_highest','FALHOU');
    EXCEPTION WHEN OTHERS THEN
      out := out || jsonb_build_object('t9_guard_highest','BLOQUEADO OK');
    END;

    -- T10 validacao required_leaders
    BEGIN
      PERFORM public.expansion_validate_required_leaders('[{"rank":"MASTER","count":1}]'::jsonb);
      out := out || jsonb_build_object('t10_rank_invalido','FALHOU');
    EXCEPTION WHEN OTHERS THEN out := out || jsonb_build_object('t10_rank_invalido','BLOQUEADO OK'); END;
    BEGIN
      PERFORM public.expansion_validate_required_leaders('[{"rank":"BRONZE","count":1,"sql":"x"}]'::jsonb);
      out := out || jsonb_build_object('t10_chave_extra','FALHOU');
    EXCEPTION WHEN OTHERS THEN out := out || jsonb_build_object('t10_chave_extra','BLOQUEADO OK'); END;
    BEGIN
      PERFORM public.expansion_validate_required_leaders('[{"rank":null,"count":2}]'::jsonb);
      out := out || jsonb_build_object('t10_null_count','FALHOU');
    EXCEPTION WHEN OTHERS THEN out := out || jsonb_build_object('t10_null_count','BLOQUEADO OK'); END;
    BEGIN
      PERFORM public.expansion_validate_required_leaders('[{"rank":"PRATA","count":1,"distinct_teams":true}]'::jsonb);
      out := out || jsonb_build_object('t10_distinct_count1','FALHOU');
    EXCEPTION WHEN OTHERS THEN out := out || jsonb_build_object('t10_distinct_count1','BLOQUEADO OK'); END;
    BEGIN
      PERFORM public.expansion_validate_required_leaders('[{"rank":"OURO","count":2,"distinct_teams":true}]'::jsonb);
      out := out || jsonb_build_object('t10_valido','ACEITO OK');
    EXCEPTION WHEN OTHERS THEN out := out || jsonb_build_object('t10_valido','FALHOU'); END;

    RAISE EXCEPTION 'ROLLBACK_FIXTURES:%', out::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'ROLLBACK_FIXTURES:%' THEN
      out := replace(SQLERRM,'ROLLBACK_FIXTURES:','')::jsonb;
    ELSE
      out := jsonb_build_object('erro', SQLERRM);
    END IF;
  END;

  RETURN out || jsonb_build_object(
    'ranks_rows_after', (SELECT count(*) FROM public.expansion_partner_ranks),
    'evaluations_rows_after', (SELECT count(*) FROM public.expansion_rank_evaluations));
END; $$;
REVOKE ALL ON FUNCTION public.expansion_part3_selftest() FROM PUBLIC;
