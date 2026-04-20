-- 1) Arquivar leilões finalizados há mais de 48h (em lotes para não travar)
DO $$
DECLARE
  rows_updated integer;
BEGIN
  LOOP
    WITH to_hide AS (
      SELECT id FROM public.auctions
      WHERE status = 'finished'
        AND COALESCE(is_hidden, false) = false
        AND finished_at < (now() - interval '48 hours')
      LIMIT 100
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.auctions a
    SET is_hidden = true
    FROM to_hide
    WHERE a.id = to_hide.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;
END $$;

-- 2) Índice composto para a query da home
CREATE INDEX IF NOT EXISTS idx_auctions_visible_recent
ON public.auctions (status, finished_at DESC)
WHERE is_hidden = false;

CREATE INDEX IF NOT EXISTS idx_auctions_status_starts_at
ON public.auctions (status, starts_at DESC)
WHERE is_hidden = false;

-- 3) Função de auto-arquivamento e cron diário
CREATE OR REPLACE FUNCTION public.archive_old_finished_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  IF NOT pg_try_advisory_lock(8675311) THEN
    RAISE NOTICE 'archive_old_finished_auctions already running, skipping';
    RETURN;
  END IF;

  BEGIN
    LOOP
      WITH to_hide AS (
        SELECT id FROM public.auctions
        WHERE status = 'finished'
          AND COALESCE(is_hidden, false) = false
          AND finished_at < (now() - interval '48 hours')
        LIMIT 200
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.auctions a
      SET is_hidden = true
      FROM to_hide
      WHERE a.id = to_hide.id;

      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      EXIT WHEN rows_updated = 0;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(8675311);
    RAISE;
  END;

  PERFORM pg_advisory_unlock(8675311);
END;
$$;

-- Agendar para rodar diariamente às 4h da manhã (horário UTC = 7h America/Sao_Paulo)
DO $$
DECLARE
  job_id bigint;
BEGIN
  FOR job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'archive-old-finished-auctions'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'archive-old-finished-auctions',
  '0 7 * * *',
  $$SELECT public.archive_old_finished_auctions();$$
);