
CREATE OR REPLACE FUNCTION public.expansion_fmt_br(_v numeric, _decimals int DEFAULT 2)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(
    trim(to_char(COALESCE(_v,0), CASE WHEN _decimals = 0 THEN 'FM999G999G999G990' ELSE 'FM999G999G999G990D00' END)),
    ',.', '.,'
  );
$$;

CREATE OR REPLACE FUNCTION public.expansion_notify_snapshot(_snapshot_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.expansion_period_snapshots%ROWTYPE;
  v_title text; v_msg text; v_link text; v_ref text; v_type text; v_period text;
BEGIN
  SELECT * INTO v FROM public.expansion_period_snapshots WHERE id = _snapshot_id;
  IF NOT FOUND OR v.user_id IS NULL THEN RETURN; END IF;

  v_period := to_char(v.period_start,'DD/MM/YYYY') || ' a ' || to_char(v.period_end,'DD/MM/YYYY');

  IF _kind = 'close' THEN
    IF v.status_official NOT IN ('closed','released') THEN RETURN; END IF;
    v_type := 'expansion_close';
    v_ref  := 'expansion_close_notification:' || _snapshot_id::text;
    v_title := 'Fechamento semanal concluído';
    v_msg :=
      'O resultado do seu Programa de Expansão no período ' || v_period ||
      ' foi calculado. Consulte o detalhamento de volume, consumo e pontos acumulados.' || E'\n' ||
      'VQE disponível: ' || public.expansion_fmt_br(COALESCE(v.vqe_points,0),0) || ' pontos.' || E'\n' ||
      'VQE pagável: ' || public.expansion_fmt_br(COALESCE(v.payable_vqe_points,0),0) || ' pontos.' || E'\n' ||
      'Teto semanal do plano' || COALESCE(' ' || v.plan_name, '') || ': R$ ' ||
        public.expansion_fmt_br(COALESCE(v.weekly_cap_value, v.weekly_cap, 0)) || '.' || E'\n' ||
      'Pontos acumulados (carryforward): ' ||
        public.expansion_fmt_br(COALESCE(v.carryforward_points,0),0) || ' pontos.' || E'\n' ||
      CASE WHEN COALESCE(v.final_bonus,0) > 0
        THEN 'Bônus calculado: R$ ' || public.expansion_fmt_br(v.final_bonus) ||
             '. O valor será disponibilizado na Carteira de Bônus após a liberação.'
        ELSE 'Neste período não houve volume qualificado suficiente para gerar bônus. Seus pontos não consumidos continuam acumulados.'
      END;
    v_link := '/minha-parceria?tab=binary&secao=historico';
  ELSIF _kind = 'release' THEN
    IF v.status_official <> 'released' OR COALESCE(v.final_bonus,0) <= 0 THEN RETURN; END IF;
    v_type := 'expansion_release';
    v_ref  := 'expansion_release_notification:' || _snapshot_id::text;
    v_title := 'Bônus de Expansão disponível';
    v_msg := 'Seu Bônus de Expansão de R$ ' || public.expansion_fmt_br(v.final_bonus) ||
             ' (período ' || v_period || ') já foi creditado na Carteira de Bônus e está disponível para solicitação de saque.';
    v_link := '/minha-parceria?tab=withdrawals';
  ELSE
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.notifications
              WHERE user_id = v.user_id AND metadata->>'ref' = v_ref) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (v.user_id, v_type, v_title, v_msg, v_link,
          jsonb_build_object('ref', v_ref, 'snapshot_id', _snapshot_id,
                             'period_start', v.period_start, 'period_end', v.period_end,
                             'final_bonus', COALESCE(v.final_bonus,0)));
END;
$$;
