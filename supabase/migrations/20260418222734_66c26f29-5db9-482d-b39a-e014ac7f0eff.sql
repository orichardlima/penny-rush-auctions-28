-- Adicionar coluna de múltiplos vencedores predefinidos
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS predefined_winner_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Migrar valor antigo (predefined_winner_id) para o array
UPDATE public.auctions
SET predefined_winner_ids = ARRAY[predefined_winner_id]
WHERE predefined_winner_id IS NOT NULL
  AND (predefined_winner_ids IS NULL OR cardinality(predefined_winner_ids) = 0);

-- Atualizar trigger de bloqueio de bots para considerar QUALQUER alvo no array
CREATE OR REPLACE FUNCTION public.block_bot_bid_when_target_leading()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_predefined_winners uuid[];
  v_legacy_winner uuid;
  v_is_bot boolean;
  v_last_bidder uuid;
BEGIN
  -- Pega os vencedores predefinidos (array novo + legado)
  SELECT predefined_winner_ids, predefined_winner_id
    INTO v_predefined_winners, v_legacy_winner
  FROM public.auctions
  WHERE id = NEW.auction_id;

  -- Garante union legacy + array
  IF v_legacy_winner IS NOT NULL AND NOT (v_legacy_winner = ANY(COALESCE(v_predefined_winners, '{}'::uuid[]))) THEN
    v_predefined_winners := COALESCE(v_predefined_winners, '{}'::uuid[]) || v_legacy_winner;
  END IF;

  -- Sem alvos => comportamento normal
  IF v_predefined_winners IS NULL OR cardinality(v_predefined_winners) = 0 THEN
    RETURN NEW;
  END IF;

  -- O autor do novo lance é bot?
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Não é bot => deixa passar
  IF NOT v_is_bot THEN
    RETURN NEW;
  END IF;

  -- É bot: verificar quem deu o último lance
  SELECT user_id INTO v_last_bidder
  FROM public.bids
  WHERE auction_id = NEW.auction_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se último lance foi de QUALQUER um dos alvos, bloquear o bot
  IF v_last_bidder = ANY(v_predefined_winners) THEN
    RAISE EXCEPTION 'BOT_BLOCKED_PREDEFINED_WINNER_LEADING'
      USING HINT = 'Bot bid blocked because a predefined winner is currently leading';
  END IF;

  RETURN NEW;
END;
$function$;