-- 1. Adicionar coluna de vencedor predefinido
ALTER TABLE public.auctions
ADD COLUMN IF NOT EXISTS predefined_winner_id uuid;

CREATE INDEX IF NOT EXISTS idx_auctions_predefined_winner ON public.auctions(predefined_winner_id) WHERE predefined_winner_id IS NOT NULL;

-- 2. Função do trigger: bloqueia bots se último lance foi do alvo
CREATE OR REPLACE FUNCTION public.block_bot_bid_when_target_leading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_predefined_winner uuid;
  v_is_bot boolean;
  v_last_bidder uuid;
BEGIN
  -- Pega o vencedor predefinido do leilão
  SELECT predefined_winner_id INTO v_predefined_winner
  FROM public.auctions
  WHERE id = NEW.auction_id;

  -- Sem alvo => comportamento normal
  IF v_predefined_winner IS NULL THEN
    RETURN NEW;
  END IF;

  -- O autor do novo lance é bot?
  SELECT COALESCE(is_bot, false) INTO v_is_bot
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Não é bot => deixa passar (jogadores reais sempre podem)
  IF NOT v_is_bot THEN
    RETURN NEW;
  END IF;

  -- É bot: verificar quem deu o último lance
  SELECT user_id INTO v_last_bidder
  FROM public.bids
  WHERE auction_id = NEW.auction_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se último lance foi do alvo, bloquear esse bot
  IF v_last_bidder = v_predefined_winner THEN
    RAISE EXCEPTION 'BOT_BLOCKED_PREDEFINED_WINNER_LEADING'
      USING HINT = 'Bot bid blocked because predefined winner is currently leading';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_bot_when_target_leading ON public.bids;
CREATE TRIGGER trg_block_bot_when_target_leading
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.block_bot_bid_when_target_leading();