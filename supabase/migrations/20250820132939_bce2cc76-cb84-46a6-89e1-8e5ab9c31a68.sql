-- CORREÇÃO URGENTE: Criar procedures para sistema de bots (permite escrita em cron)

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
  -- Buscar leilões ativos com timer expandido (0-15 segundos) e meta de receita
  FOR auction_record IN 
    SELECT 
      a.id,
      a.time_left,
      a.revenue_target,
      a.current_price,
      a.bid_increment,
      a.bid_cost,
      a.ends_at,
      a.market_value,
      a.title
    FROM public.auctions a
    WHERE a.status = 'active' 
      AND a.time_left <= 15
      AND a.time_left >= 0
      AND a.revenue_target > 0
  LOOP
    
    -- Calcular receita atual
    SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
    
    -- Calcular porcentagem da meta
    revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
    
    RAISE LOG '🤖 [BOT-PROC] Avaliando leilão %: timer=%s, receita=%s/%s (%.1f%%), preço=R$%.2f', 
      auction_record.id, auction_record.time_left, current_revenue, auction_record.revenue_target, 
      revenue_percentage, auction_record.current_price;
    
    -- Condições para intervenção do bot
    IF revenue_percentage < 80 OR 
       (auction_record.market_value > 0 AND auction_record.current_price < (auction_record.market_value * 0.9)) THEN
      
      RAISE LOG '🚨 [BOT-PROC] Ativando bot para leilão "%" (ID: %): receita %.1f%% da meta', 
        auction_record.title, auction_record.id, revenue_percentage;
      
      -- Obter bot
      SELECT public.get_random_bot() INTO bot_id;
      
      -- Inserir lance do bot
      INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (auction_record.id, bot_id, auction_record.current_price + auction_record.bid_increment, auction_record.bid_cost);
      
      RAISE LOG '✅ [BOT-PROC] Bot % executou lance no leilão %: novo preço R$%.2f', 
        bot_id, auction_record.id, (auction_record.current_price + auction_record.bid_increment);
        
    ELSE
      RAISE LOG '✋ [BOT-PROC] Leilão % não precisa de intervenção: receita %.1f%% OK', 
        auction_record.id, revenue_percentage;
    END IF;
  END LOOP;
  
  RAISE LOG '🏁 [BOT-PROC] Verificação automática concluída';
END;
$$;

-- 2. Criar novos cron jobs usando CALL
SELECT cron.schedule(
  'bot-system-proc', 
  '*/3 * * * * *', -- A cada 3 segundos
  'CALL public.auto_bid_system_procedure();'
);

-- 3. Teste imediato - executar procedure manualmente
CALL public.auto_bid_system_procedure();