CREATE OR REPLACE FUNCTION public.expansion_get_team_network(
  _team_root_user_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ps DATE; v_pe DATE; v_res JSONB;
BEGIN
  IF _user_id IS NULL OR _team_root_user_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN '[]'::jsonb; END IF;

  -- a equipe precisa pertencer ao parceiro consultante
  IF NOT EXISTS (
    SELECT 1 FROM public.expansion_team_memberships m
     WHERE m.ancestor_user_id = _user_id
       AND m.team_root_user_id = _team_root_user_id
       AND m.effective_to IS NULL
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT period_start, period_end INTO v_ps, v_pe FROM public.expansion_current_period();

  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'depth')::int ASC, (x->>'joined_at') ASC), '[]'::jsonb)
    INTO v_res
  FROM (
    SELECT jsonb_build_object(
      'user_id', m.descendant_user_id,
      'name', COALESCE(p.full_name, 'Parceiro'),
      'avatar_url', p.avatar_url,
      'depth', m.depth,
      'is_root', m.descendant_user_id = _team_root_user_id,
      'joined_at', m.effective_from,
      'plan_name', (SELECT c.plan_name FROM public.partner_contracts c
                     WHERE c.user_id = m.descendant_user_id AND c.status = 'ACTIVE'
                     ORDER BY c.created_at DESC LIMIT 1),
      'is_active', EXISTS (SELECT 1 FROM public.partner_contracts c
                            WHERE c.user_id = m.descendant_user_id AND c.status = 'ACTIVE'),
      'sponsor_user_id', sp.ancestor_user_id,
      'sponsor_name', COALESCE(spp.full_name, 'Parceiro'),
      'points_total', COALESCE((
        SELECT SUM(l.points) FROM public.expansion_points_ledger l
         WHERE l.user_id = m.descendant_user_id AND l.status = 'CONFIRMED'
           AND l.created_at >= m.effective_from
           AND (m.effective_to IS NULL OR l.created_at < m.effective_to)), 0),
      'week_points', COALESCE((
        SELECT SUM(l.points) FROM public.expansion_points_ledger l
         WHERE l.user_id = m.descendant_user_id AND l.status = 'CONFIRMED'
           AND l.created_at >= m.effective_from
           AND (m.effective_to IS NULL OR l.created_at < m.effective_to)
           AND (l.created_at AT TIME ZONE 'America/Bahia')::date BETWEEN v_ps AND v_pe), 0)
    ) AS x
    FROM public.expansion_team_memberships m
    LEFT JOIN public.profiles p ON p.user_id = m.descendant_user_id
    LEFT JOIN LATERAL (
      SELECT m2.ancestor_user_id
        FROM public.expansion_team_memberships m2
       WHERE m2.descendant_user_id = m.descendant_user_id
         AND m2.depth = 1 AND m2.effective_to IS NULL
       LIMIT 1
    ) sp ON true
    LEFT JOIN public.profiles spp ON spp.user_id = sp.ancestor_user_id
    WHERE m.ancestor_user_id = _user_id
      AND m.team_root_user_id = _team_root_user_id
      AND m.effective_to IS NULL
  ) s;

  RETURN v_res;
END; $function$;

REVOKE ALL ON FUNCTION public.expansion_get_team_network(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expansion_get_team_network(uuid, uuid) TO authenticated, service_role, postgres;