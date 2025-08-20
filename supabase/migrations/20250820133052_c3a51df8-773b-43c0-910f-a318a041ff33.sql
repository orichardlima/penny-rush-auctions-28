-- CORREÇÃO URGENTE: Criar procedures e ajustar triggers para permitir bots com time_left=0

-- 1. Criar procedure para sistema de bots
CREATE OR REPLACE PROCEDURE public.auto_bid_system_procedure()
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  auction_record record;
  current_revenue integer;
  revenue_percentage decimal;
  bot_id uuid;
BEGIN
  FOR auction_record IN 
    SELECT 
      a.id,
      a.time_left,
      a.revenue_target,
      a.current_price,
      a.bid_increment,
      a.bid_cost,
      a.market_value,
      a.title
    FROM public.auctions a
    WHERE a.status = 'active' 
      AND a.revenue_target > 0
  LOOP
    
    SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
    revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
    
    RAISE LOG '🤖 [BOT-PROC] Avaliando leilão %: timer=%s, receita=%.1f%%', 
      auction_record.id, auction_record.time_left, revenue_percentage;
    
    -- Condições para intervenção do bot
    IF revenue_percentage < 80 OR 
       (auction_record.market_value > 0 AND auction_record.current_price < (auction_record.market_value * 0.9)) THEN
      
      SELECT public.get_random_bot() INTO bot_id;
      
      INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (auction_record.id, bot_id, auction_record.current_price + auction_record.bid_increment, auction_record.bid_cost);
      
      RAISE LOG '✅ [BOT-PROC] Bot executou lance no leilão %', auction_record.id;
    END IF;
  END LOOP;
  
  RAISE LOG '🏁 [BOT-PROC] Verificação concluída';
END;
$$;

-- 2. Ajustar trigger para permitir bots em leilões com time_left=0 mas status=active
CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  a RECORD;
  is_bot_user boolean := false;
BEGIN
  SELECT id, status, ends_at, time_left INTO a
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Verificar se é bot
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  -- NOVA LÓGICA: Permitir bots mesmo com time_left=0 se status=active
  -- Isso permite que o sistema de proteção funcione
  IF is_bot_user AND a.status = 'active' THEN
    RETURN NEW;  -- Bot pode fazer lance em leilão ativo
  END IF;

  -- Para usuários normais, aplicar regras normais
  IF a.status <> 'active' OR 
     (a.ends_at IS NOT NULL AND a.ends_at <= timezone('America/Sao_Paulo', now())) OR 
     COALESCE(a.time_left, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Criar cron job
SELECT cron.schedule(
  'bot-system-proc', 
  '*/3 * * * * *',
  'CALL public.auto_bid_system_procedure();'
);