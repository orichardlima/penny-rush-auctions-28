
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
      'VQE disponível: ' || trim(to_char(COALESCE(v.vqe_points,0),'FM999G999G999')) || ' pontos.' || E'\n' ||
      'VQE pagável: ' || trim(to_char(COALESCE(v.payable_vqe_points,0),'FM999G999G999')) || ' pontos.' || E'\n' ||
      'Teto semanal do plano' || COALESCE(' ' || v.plan_name, '') || ': R$ ' ||
        trim(to_char(COALESCE(v.weekly_cap_value, v.weekly_cap, 0),'FM999G999G990D00')) || '.' || E'\n' ||
      'Pontos acumulados (carryforward): ' ||
        trim(to_char(COALESCE(v.carryforward_points,0),'FM999G999G999')) || ' pontos.' || E'\n' ||
      CASE WHEN COALESCE(v.final_bonus,0) > 0
        THEN 'Bônus calculado: R$ ' || trim(to_char(v.final_bonus,'FM999G999G990D00')) ||
             '. O valor será disponibilizado na Carteira de Bônus após a liberação.'
        ELSE 'Neste período não houve volume qualificado suficiente para gerar bônus. Seus pontos não consumidos continuam acumulados.'
      END;
    v_link := '/minha-parceria?tab=binary&secao=historico';
  ELSIF _kind = 'release' THEN
    IF v.status_official <> 'released' OR COALESCE(v.final_bonus,0) <= 0 THEN RETURN; END IF;
    v_type := 'expansion_release';
    v_ref  := 'expansion_release_notification:' || _snapshot_id::text;
    v_title := 'Bônus de Expansão disponível';
    v_msg := 'Seu Bônus de Expansão de R$ ' || trim(to_char(v.final_bonus,'FM999G999G990D00')) ||
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

GRANT EXECUTE ON FUNCTION public.expansion_notify_snapshot(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.expansion_snapshot_status_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_official = 'closed'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status_official,'') <> 'closed') THEN
    PERFORM public.expansion_notify_snapshot(NEW.id, 'close');
  ELSIF NEW.status_official = 'released'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status_official,'') <> 'released') THEN
    PERFORM public.expansion_notify_snapshot(NEW.id, 'close');
    PERFORM public.expansion_notify_snapshot(NEW.id, 'release');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expansion_snapshot_status_notify ON public.expansion_period_snapshots;
CREATE TRIGGER trg_expansion_snapshot_status_notify
AFTER INSERT OR UPDATE OF status_official ON public.expansion_period_snapshots
FOR EACH ROW EXECUTE FUNCTION public.expansion_snapshot_status_notify();
