CREATE OR REPLACE FUNCTION public.admin_get_cron_jobs_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_start timestamptz,
  last_end timestamptz,
  last_status text,
  last_return_message text,
  duration_ms integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH last_runs AS (
    SELECT DISTINCT ON (jr.jobid)
      jr.jobid,
      jr.start_time,
      jr.end_time,
      jr.status,
      jr.return_message
    FROM cron.job_run_details jr
    ORDER BY jr.jobid, jr.start_time DESC
  )
  SELECT
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    lr.start_time,
    lr.end_time,
    lr.status::text,
    lr.return_message::text,
    CASE WHEN lr.end_time IS NOT NULL AND lr.start_time IS NOT NULL
      THEN (EXTRACT(EPOCH FROM (lr.end_time - lr.start_time)) * 1000)::int
      ELSE NULL END AS duration_ms
  FROM cron.job j
  LEFT JOIN last_runs lr ON lr.jobid = j.jobid
  WHERE j.jobname LIKE 'sync-timers-protection-%'
  ORDER BY j.jobname;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_cron_jobs_status() TO authenticated;