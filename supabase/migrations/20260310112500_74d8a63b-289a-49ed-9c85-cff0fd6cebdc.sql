-- 1) Garantir que todos os leilões finalizados tenham vencedor BOT
WITH auctions_without_bot_winner AS (
  SELECT a.id
  FROM public.auctions a
  LEFT JOIN public.profiles wp ON wp.user_id = a.winner_id
  WHERE a.status = 'finished'
    AND COALESCE(wp.is_bot, false) = false
), random_bot_per_auction AS (
  SELECT
    a.id,
    rb.user_id,
    rb.full_name,
    rb.city,
    rb.state
  FROM auctions_without_bot_winner a
  CROSS JOIN LATERAL (
    SELECT p.user_id, p.full_name, p.city, p.state
    FROM public.profiles p
    WHERE p.is_bot = true
    ORDER BY random()
    LIMIT 1
  ) rb
)
UPDATE public.auctions au
SET
  winner_id = rb.user_id,
  winner_name = CASE
    WHEN rb.city IS NOT NULL AND rb.state IS NOT NULL
      THEN rb.full_name || ' - ' || rb.city || ', ' || rb.state
    ELSE rb.full_name
  END
FROM random_bot_per_auction rb
WHERE au.id = rb.id;

-- 2) Sincronizar last_bidders para que o primeiro nome seja sempre o bot vencedor
WITH winner_display AS (
  SELECT
    a.id,
    CASE
      WHEN strpos(n.base_name, ' ') > 0
        THEN split_part(n.base_name, ' ', 1) || ' ' || split_part(trim(substr(n.base_name, strpos(n.base_name, ' ') + 1)), ' ', 1)
      ELSE n.base_name
    END AS bot_display,
    COALESCE(a.last_bidders, '[]'::jsonb) AS current_bidders
  FROM public.auctions a
  JOIN public.profiles p ON p.user_id = a.winner_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(trim(p.full_name), ''),
      NULLIF(trim(split_part(COALESCE(a.winner_name, ''), ' - ', 1)), ''),
      'Bot'
    ) AS base_name
  ) n
  WHERE a.status = 'finished'
    AND p.is_bot = true
), patched AS (
  SELECT
    id,
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(to_jsonb(bot_display) || current_bidders) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord
        LIMIT 3
      ) s
    ) AS new_bidders
  FROM winner_display
)
UPDATE public.auctions a
SET last_bidders = p.new_bidders
FROM patched p
WHERE a.id = p.id
  AND (
    a.last_bidders IS NULL
    OR jsonb_array_length(a.last_bidders) = 0
    OR (a.last_bidders ->> 0) IS DISTINCT FROM (p.new_bidders ->> 0)
  );