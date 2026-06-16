CREATE OR REPLACE FUNCTION public.tick_bot_executor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Executor leve: apenas dispara lances já vencidos.
  -- Sem advisory lock (execute_overdue_bot_bids usa FOR UPDATE SKIP LOCKED).
  PERFORM public.execute_overdue_bot_bids();
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[TICK-BOT-EXECUTOR] erro: %', SQLERRM;
END;
$$;