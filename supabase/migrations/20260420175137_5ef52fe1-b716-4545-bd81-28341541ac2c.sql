-- Wrapper seguro para bot_protection_loop com advisory lock
CREATE OR REPLACE FUNCTION public.bot_protection_loop_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tenta pegar lock; se já está em uso, sai imediatamente sem empilhar
  IF NOT pg_try_advisory_lock(8675309) THEN
    RAISE NOTICE 'bot_protection_loop already running, skipping';
    RETURN;
  END IF;

  BEGIN
    PERFORM public.bot_protection_loop();
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(8675309);
    RAISE;
  END;

  PERFORM pg_advisory_unlock(8675309);
END;
$$;

-- Wrapper seguro para execute_overdue_bot_bids com advisory lock
CREATE OR REPLACE FUNCTION public.execute_overdue_bot_bids_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT pg_try_advisory_lock(8675310) THEN
    RAISE NOTICE 'execute_overdue_bot_bids already running, skipping';
    RETURN;
  END IF;

  BEGIN
    PERFORM public.execute_overdue_bot_bids();
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(8675310);
    RAISE;
  END;

  PERFORM pg_advisory_unlock(8675310);
END;
$$;

-- Reagendar os cron jobs existentes para usar os wrappers seguros
DO $$
DECLARE
  job_id bigint;
BEGIN
  -- Remove jobs antigos pelo nome (se existirem)
  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname IN ('bot-protection-loop', 'execute-overdue-bot-bids')
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'bot-protection-loop',
  '* * * * *',
  $$SELECT public.bot_protection_loop_safe();$$
);

SELECT cron.schedule(
  'execute-overdue-bot-bids',
  '* * * * *',
  $$SELECT public.execute_overdue_bot_bids_safe();$$
);