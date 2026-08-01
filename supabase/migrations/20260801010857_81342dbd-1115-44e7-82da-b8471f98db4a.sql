
CREATE TABLE IF NOT EXISTS public.expansion_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  audience text NOT NULL DEFAULT 'active_partners',
  recipients_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.expansion_communications TO authenticated;
GRANT ALL ON public.expansion_communications TO service_role;
ALTER TABLE public.expansion_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view expansion communications" ON public.expansion_communications;
CREATE POLICY "Admins can view expansion communications"
  ON public.expansion_communications FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- Broadcast oficial
CREATE OR REPLACE FUNCTION public.expansion_admin_broadcast(
  _title text, _message text, _link text DEFAULT '/minha-parceria?tab=expansion',
  _audience text DEFAULT 'active_partners'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_count int := 0; v_link text;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF COALESCE(btrim(_title),'') = '' OR COALESCE(btrim(_message),'') = '' THEN
    RAISE EXCEPTION 'Título e mensagem são obrigatórios';
  END IF;
  IF _audience NOT IN ('all_partners','active_partners') THEN
    RAISE EXCEPTION 'Público-alvo inválido';
  END IF;

  v_link := NULLIF(btrim(COALESCE(_link,'')), '');
  v_id := gen_random_uuid();

  WITH targets AS (
    SELECT DISTINCT pc.user_id
      FROM public.partner_contracts pc
     WHERE (_audience = 'all_partners' OR pc.status = 'ACTIVE')
       AND pc.user_id IS NOT NULL
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT t.user_id, 'expansion_announcement', btrim(_title), btrim(_message), v_link,
           jsonb_build_object('ref', 'expansion_announcement:' || v_id::text, 'communication_id', v_id)
      FROM targets t
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM ins;

  INSERT INTO public.expansion_communications (id, title, message, link, audience, recipients_count, created_by)
  VALUES (v_id, btrim(_title), btrim(_message), v_link, _audience, v_count, auth.uid());

  RETURN jsonb_build_object('success', true, 'communication_id', v_id, 'recipients', v_count);
END; $$;

REVOKE ALL ON FUNCTION public.expansion_admin_broadcast(text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_broadcast(text,text,text,text) TO authenticated;

-- Histórico de comunicados
CREATE OR REPLACE FUNCTION public.expansion_admin_communications(_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at' DESC), '[]'::jsonb) INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'title', c.title, 'message', c.message, 'link', c.link,
      'audience', c.audience, 'recipients_count', c.recipients_count,
      'created_at', c.created_at,
      'read_count', (SELECT COUNT(*) FROM public.notifications n
                      WHERE n.metadata->>'communication_id' = c.id::text AND n.read_at IS NOT NULL)
    ) AS x
    FROM public.expansion_communications c
    ORDER BY c.created_at DESC
    LIMIT GREATEST(COALESCE(_limit,50),1)
  ) s;
  RETURN v;
END; $$;

REVOKE ALL ON FUNCTION public.expansion_admin_communications(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expansion_admin_communications(int) TO authenticated;

-- Alerta de teto semanal (>= 80%)
CREATE OR REPLACE FUNCTION public.expansion_notify_cap_alerts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ps date; v_pe date; r RECORD; v jsonb; v_cap numeric; v_bonus numeric;
  v_ref text; v_sent int := 0;
BEGIN
  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();
  IF v_pe IS NULL THEN RETURN jsonb_build_object('sent', 0); END IF;

  FOR r IN
    SELECT DISTINCT pc.user_id
      FROM public.partner_contracts pc
     WHERE pc.status = 'ACTIVE' AND COALESCE(pc.is_demo,false) = false
  LOOP
    v := public.expansion_compute_week(r.user_id, v_pe);
    v_cap := COALESCE((v->>'weekly_cap')::numeric, 0);
    v_bonus := COALESCE((v->>'final_bonus')::numeric, 0);
    IF v_cap <= 0 OR v_bonus < v_cap * 0.8 THEN CONTINUE; END IF;

    v_ref := 'expansion_cap_alert:' || r.user_id::text || ':' || v_pe::text;
    IF EXISTS (SELECT 1 FROM public.notifications n
                WHERE n.user_id = r.user_id AND n.metadata->>'ref' = v_ref) THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      r.user_id, 'expansion_cap_alert',
      CASE WHEN v_bonus >= v_cap THEN 'Teto semanal atingido' ELSE 'Você está perto do teto semanal' END,
      'No período de ' || to_char(v_ps,'DD/MM/YYYY') || ' a ' || to_char(v_pe,'DD/MM/YYYY') ||
      ', seu bônus estimado é R$ ' || public.expansion_fmt_br(v_bonus) ||
      ' e o teto semanal do seu plano é R$ ' || public.expansion_fmt_br(v_cap) || '. ' ||
      CASE WHEN v_bonus >= v_cap
        THEN 'O excedente permanece acumulado como pontos para as próximas semanas.'
        ELSE 'Acompanhe o uso do teto na sua área de parceria.' END,
      '/minha-parceria?tab=expansion',
      jsonb_build_object('ref', v_ref, 'period_start', v_ps, 'period_end', v_pe,
                         'estimated_bonus', v_bonus, 'weekly_cap', v_cap)
    );
    v_sent := v_sent + 1;
  END LOOP;

  RETURN jsonb_build_object('sent', v_sent, 'period_start', v_ps, 'period_end', v_pe);
END; $$;

REVOKE ALL ON FUNCTION public.expansion_notify_cap_alerts() FROM public, anon;

SELECT cron.unschedule('expansion-cap-alerts') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expansion-cap-alerts'
);
SELECT cron.schedule('expansion-cap-alerts', '0 15 * * *', $$SELECT public.expansion_notify_cap_alerts();$$);
