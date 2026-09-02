-- lovable-cron-fallback-reviewed: 48 runs/day; libera bônus de indicação cujo prazo de carência de 168h vence em hora cheia e minuto exato do dia; substitui 2 jobs horários por 1, reduzindo pressão de workers (causa do job startup timeout)
CREATE TABLE IF NOT EXISTS public.bonus_maintenance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger_source text NOT NULL DEFAULT 'CRON',
  status text NOT NULL DEFAULT 'RUNNING',
  released_count integer NOT NULL DEFAULT 0,
  expired_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bonus_maintenance_runs TO authenticated;
GRANT ALL ON public.bonus_maintenance_runs TO service_role;

ALTER TABLE public.bonus_maintenance_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view bonus maintenance runs" ON public.bonus_maintenance_runs;
CREATE POLICY "Admins can view bonus maintenance runs"
ON public.bonus_maintenance_runs
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_bonus_maintenance_runs_started
  ON public.bonus_maintenance_runs (started_at DESC);

CREATE OR REPLACE FUNCTION public.run_bonus_maintenance(_source text DEFAULT 'CRON')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id uuid;
  v_errors jsonb := '[]'::jsonb;
  v_released integer := 0;
  v_expired integer := 0;
  v_status text := 'SUCCESS';
BEGIN
  IF NOT pg_try_advisory_lock(hashtext('run_bonus_maintenance')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_running');
  END IF;

  INSERT INTO public.bonus_maintenance_runs (trigger_source)
  VALUES (COALESCE(_source, 'CRON'))
  RETURNING id INTO v_run_id;

  BEGIN
    SELECT COUNT(*) INTO v_released
    FROM public.partner_referral_bonuses
    WHERE status = 'PENDING' AND available_at IS NOT NULL AND available_at <= now();

    PERFORM public.release_pending_referral_bonuses();
  EXCEPTION WHEN OTHERS THEN
    v_status := 'PARTIAL';
    v_released := 0;
    v_errors := v_errors || jsonb_build_object('step', 'release_pending_referral_bonuses', 'error', SQLERRM);
  END;

  BEGIN
    PERFORM public.expire_suspended_bonuses();
  EXCEPTION WHEN OTHERS THEN
    v_status := 'PARTIAL';
    v_errors := v_errors || jsonb_build_object('step', 'expire_suspended_bonuses', 'error', SQLERRM);
  END;

  IF jsonb_array_length(v_errors) >= 2 THEN
    v_status := 'FAILED';
  END IF;

  UPDATE public.bonus_maintenance_runs
  SET finished_at = now(),
      status = v_status,
      released_count = v_released,
      expired_count = v_expired,
      errors = v_errors
  WHERE id = v_run_id;

  PERFORM pg_advisory_unlock(hashtext('run_bonus_maintenance'));

  RETURN jsonb_build_object('run_id', v_run_id, 'status', v_status, 'released', v_released, 'errors', v_errors);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock(hashtext('run_bonus_maintenance'));
  UPDATE public.bonus_maintenance_runs
  SET finished_at = now(), status = 'FAILED',
      errors = jsonb_build_array(jsonb_build_object('step', 'run', 'error', SQLERRM))
  WHERE id = v_run_id;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.run_bonus_maintenance(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_bonus_maintenance(text) FROM anon;
REVOKE ALL ON FUNCTION public.run_bonus_maintenance(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_bonus_maintenance(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_bonus_maintenance(text) TO postgres;

CREATE OR REPLACE FUNCTION public.run_bonus_maintenance_fallback()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT MAX(finished_at) INTO v_last
  FROM public.bonus_maintenance_runs
  WHERE status IN ('SUCCESS', 'PARTIAL');

  IF v_last IS NOT NULL AND v_last > now() - interval '2 hours' THEN
    RETURN jsonb_build_object('skipped', true, 'last_success', v_last);
  END IF;

  RETURN public.run_bonus_maintenance('CRON_FALLBACK');
END;
$$;

REVOKE ALL ON FUNCTION public.run_bonus_maintenance_fallback() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_bonus_maintenance_fallback() FROM anon;
REVOKE ALL ON FUNCTION public.run_bonus_maintenance_fallback() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_bonus_maintenance_fallback() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_bonus_maintenance_fallback() TO postgres;

DO $$
BEGIN PERFORM cron.unschedule('release-referral-bonuses'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN PERFORM cron.unschedule('expire-suspended-bonuses'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN PERFORM cron.unschedule('bonus-maintenance-30min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN PERFORM cron.unschedule('bonus-maintenance-fallback'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('bonus-maintenance-30min', '17,47 * * * *', $$SELECT public.run_bonus_maintenance('CRON');$$);
SELECT cron.schedule('bonus-maintenance-fallback', '25 */3 * * *', $$SELECT public.run_bonus_maintenance_fallback();$$);