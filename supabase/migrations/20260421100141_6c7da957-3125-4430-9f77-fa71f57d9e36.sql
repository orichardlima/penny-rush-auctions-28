-- 1. Funções de advisory lock (rede de segurança contra execução concorrente)
CREATE OR REPLACE FUNCTION public.try_protection_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pg_try_advisory_lock(8675309); $$;

CREATE OR REPLACE FUNCTION public.release_protection_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pg_advisory_unlock(8675309); $$;

REVOKE ALL ON FUNCTION public.try_protection_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_protection_lock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_protection_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_protection_lock() TO service_role;

-- 2. Reagendar bot-protection-loop para rodar a cada 30s (2x por minuto)
DO $$
BEGIN
  PERFORM cron.unschedule('bot-protection-loop')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-protection-loop');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('bot-protection-loop-00')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-protection-loop-00');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('bot-protection-loop-30')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-protection-loop-30');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'bot-protection-loop-00',
  '* * * * *',
  $$ SELECT public.bot_protection_loop_safe(); $$
);

SELECT cron.schedule(
  'bot-protection-loop-30',
  '* * * * *',
  $$ SELECT pg_sleep(30); SELECT public.bot_protection_loop_safe(); $$
);

-- 3. Reagendar execute-overdue-bot-bids para rodar a cada 30s (2x por minuto)
DO $$
BEGIN
  PERFORM cron.unschedule('execute-overdue-bot-bids')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-overdue-bot-bids');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('execute-overdue-bot-bids-00')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-overdue-bot-bids-00');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('execute-overdue-bot-bids-30')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-overdue-bot-bids-30');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'execute-overdue-bot-bids-00',
  '* * * * *',
  $$ SELECT public.execute_overdue_bot_bids_safe(); $$
);

SELECT cron.schedule(
  'execute-overdue-bot-bids-30',
  '* * * * *',
  $$ SELECT pg_sleep(30); SELECT public.execute_overdue_bot_bids_safe(); $$
);