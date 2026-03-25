CREATE OR REPLACE FUNCTION public.get_random_bot()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bot_user_id uuid;
BEGIN
  SELECT p.user_id INTO bot_user_id
  FROM public.profiles p
  WHERE p.is_bot = true
    AND p.user_id NOT IN (
      SELECT a.winner_id FROM public.auctions a
      WHERE a.status = 'finished'
        AND a.winner_id IS NOT NULL
        AND a.finished_at >= now() - interval '48 hours'
    )
  ORDER BY random()
  LIMIT 1;

  IF bot_user_id IS NULL THEN
    SELECT user_id INTO bot_user_id
    FROM public.profiles
    WHERE is_bot = true
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF bot_user_id IS NULL THEN
    bot_user_id := 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6'::uuid;
  END IF;

  RETURN bot_user_id;
END;
$$;