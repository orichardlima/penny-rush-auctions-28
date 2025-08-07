-- Corrigir warnings de segurança: adicionar search_path às funções

-- Recriar função get_auction_revenue com search_path seguro
CREATE OR REPLACE FUNCTION public.get_auction_revenue(auction_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_revenue integer := 0;
BEGIN
  SELECT COALESCE(SUM(cost_paid), 0)
  INTO total_revenue
  FROM public.bids
  WHERE auction_id = auction_uuid;
  
  RETURN total_revenue;
END;
$$;

-- Recriar função ensure_bot_user com search_path seguro
CREATE OR REPLACE FUNCTION public.ensure_bot_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bot_user_id uuid;
BEGIN
  -- Buscar ou criar perfil do bot
  SELECT user_id INTO bot_user_id
  FROM public.profiles
  WHERE email = 'bot@sistema.local'
  LIMIT 1;
  
  IF bot_user_id IS NULL THEN
    -- Criar um UUID fixo para o bot
    bot_user_id := gen_random_uuid();
    
    INSERT INTO public.profiles (
      user_id, 
      full_name, 
      email, 
      bids_balance,
      is_admin
    ) VALUES (
      bot_user_id,
      'Sistema Bot',
      'bot@sistema.local',
      999999999,  -- Saldo infinito para o bot
      false
    );
  END IF;
  
  RETURN bot_user_id;
END;
$$;

-- Recriar função update_auction_stats com search_path seguro
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Atualizar total de bids e resetar timer
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment,
    time_left = 15,  -- Reset timer para 15 segundos
    updated_at = now()
  WHERE id = NEW.auction_id;
  
  -- Se o leilão atingiu a meta de proteção, desativar proteção
  UPDATE public.auctions
  SET protected_mode = false
  WHERE id = NEW.auction_id 
    AND protected_mode = true
    AND protected_target > 0
    AND (
      SELECT COALESCE(SUM(cost_paid), 0)
      FROM public.bids
      WHERE auction_id = NEW.auction_id
    ) >= protected_target;
  
  RETURN NEW;
END;
$$;