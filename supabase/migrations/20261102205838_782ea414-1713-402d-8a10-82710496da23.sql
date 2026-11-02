DO $do$
DECLARE v text;
BEGIN
  SELECT pg_get_functiondef('public.process_fast_start_bonus(uuid,uuid)'::regprocedure) INTO v;
  v := replace(v, E',\n                  updated_at = now()', '');
  EXECUTE v;
END $do$;