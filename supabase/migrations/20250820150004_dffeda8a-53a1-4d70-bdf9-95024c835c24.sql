-- PLANO INTELIGENTE: Correção definitiva do timer oscilante

-- 1. Ajustar sistema de bots para atuar ANTES do timer chegar a 0
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
      AND a.time_left <= 3    -- Só atuar nos últimos 3 segundos
      AND a.time_left > 0     -- MAS NUNCA com timer zerado
      AND a.revenue_target > 0
  LOOP
    
    SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
    revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
    
    RAISE LOG '🤖 [BOT-SMART] Leilão %: timer=%s, receita=%.1f%% (janela: 3s-1s)', 
      auction_record.id, auction_record.time_left, revenue_percentage;
    
    -- Condições para intervenção do bot (mesmas de antes)
    IF revenue_percentage < 80 OR 
       (auction_record.market_value > 0 AND auction_record.current_price < (auction_record.market_value * 0.9)) THEN
      
      SELECT public.get_random_bot() INTO bot_id;
      
      INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (auction_record.id, bot_id, auction_record.current_price + auction_record.bid_increment, auction_record.bid_cost);
      
      RAISE LOG '✅ [BOT-SMART] Bot executou lance no leilão % com %s restantes', 
        auction_record.id, auction_record.time_left;
    ELSE
      RAISE LOG '⏭️ [BOT-SMART] Leilão % não precisa de intervenção (timer: %s)', 
        auction_record.id, auction_record.time_left;
    END IF;
  END LOOP;
  
  RAISE LOG '🏁 [BOT-SMART] Verificação inteligente concluída';
END;
$$;

-- 2. Restaurar trigger original - NÃO permitir lances com timer zerado
CREATE OR REPLACE FUNCTION public.prevent_bids_on_inactive_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  a RECORD;
BEGIN
  SELECT id, status, ends_at, time_left INTO a
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- REGRA ÚNICA: NINGUÉM (nem bots) pode dar lance com timer <= 0
  -- Isso elimina a oscilação visual
  IF a.status <> 'active' OR 
     (a.ends_at IS NOT NULL AND a.ends_at <= timezone('America/Sao_Paulo', now())) OR 
     COALESCE(a.time_left, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot place bids on inactive or finished auctions';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Atualizar cron job para verificar a cada 2 segundos (mais responsivo)
SELECT cron.unschedule('bot-system-proc');

SELECT cron.schedule(
  'bot-system-smart', 
  '*/2 * * * * *',  -- A cada 2 segundos
  'CALL public.auto_bid_system_procedure();'
);