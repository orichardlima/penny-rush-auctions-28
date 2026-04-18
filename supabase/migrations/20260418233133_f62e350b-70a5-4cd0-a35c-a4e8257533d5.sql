-- 1. Adicionar colunas de configuração em auctions
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS open_win_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_bids_to_qualify INTEGER NOT NULL DEFAULT 0;

-- 2. Recriar função de bloqueio de bot levando em conta open_win_mode
CREATE OR REPLACE FUNCTION public.block_bot_bid_when_target_leading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_is_bot BOOLEAN;
  v_last_bidder_id UUID;
  v_last_bidder_is_bot BOOLEAN;
  v_real_bid_count INTEGER;
BEGIN
  -- Verifica se quem está inserindo é bot
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Se não é bot, deixa passar normalmente
  IF NOT COALESCE(v_is_bot, false) THEN
    RETURN NEW;
  END IF;

  -- Carrega leilão
  SELECT id, predefined_winner_ids, open_win_mode, min_bids_to_qualify
    INTO v_auction
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Pega último lance anterior (líder atual)
  SELECT user_id INTO v_last_bidder_id
  FROM public.bids
  WHERE auction_id = NEW.auction_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Sem líder ainda → bot pode dar lance
  IF v_last_bidder_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Regra 1: líder está na lista de predefinidos → bloquear bot (regra antiga preservada)
  IF v_auction.predefined_winner_ids IS NOT NULL
     AND array_length(v_auction.predefined_winner_ids, 1) > 0
     AND v_last_bidder_id = ANY(v_auction.predefined_winner_ids) THEN
    RAISE EXCEPTION 'BOT_BLOCKED_PREDEFINED_WINNER_LEADING';
  END IF;

  -- Regra 2: open_win_mode ligado → checar se líder é real e está qualificado
  IF COALESCE(v_auction.open_win_mode, false) = true THEN
    SELECT COALESCE(is_bot, false) INTO v_last_bidder_is_bot
    FROM public.profiles
    WHERE user_id = v_last_bidder_id;

    IF NOT COALESCE(v_last_bidder_is_bot, false) THEN
      -- Líder é real. Verificar lances mínimos.
      IF COALESCE(v_auction.min_bids_to_qualify, 0) <= 0 THEN
        RAISE EXCEPTION 'BOT_BLOCKED_PREDEFINED_WINNER_LEADING';
      END IF;

      SELECT COUNT(*) INTO v_real_bid_count
      FROM public.bids
      WHERE auction_id = NEW.auction_id
        AND user_id = v_last_bidder_id;

      IF v_real_bid_count >= v_auction.min_bids_to_qualify THEN
        RAISE EXCEPTION 'BOT_BLOCKED_PREDEFINED_WINNER_LEADING';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
