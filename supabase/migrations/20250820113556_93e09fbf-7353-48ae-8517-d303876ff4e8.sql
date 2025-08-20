-- Correção crítica do sistema de bots e finalização de leilões
-- Fix #1: Corrigir função auto_bid_system para expandir janela de ação dos bots

CREATE OR REPLACE FUNCTION public.auto_bid_system()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
      AND a.time_left <= 15  -- Expandido de 7 para 15
      AND a.time_left >= 0   -- Mudado de > 1 para >= 0
      AND a.revenue_target > 0
  LOOP
    
    -- Calcular receita atual
    SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
    
    -- Calcular porcentagem da meta
    revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
    
    RAISE LOG '🤖 [BOT-SYSTEM] Avaliando leilão %: timer=%s, receita=%s/%s (%.1f%%), preço=R$%.2f, meta=R$%', 
      auction_record.id, auction_record.time_left, current_revenue, auction_record.revenue_target, 
      revenue_percentage, auction_record.current_price, auction_record.market_value;
    
    -- Condições para intervenção do bot:
    -- 1. Receita < 80% da meta OU
    -- 2. Preço atual < 90% do valor de mercado (para evitar leilões muito baratos)
    IF revenue_percentage < 80 OR 
       (auction_record.market_value > 0 AND auction_record.current_price < (auction_record.market_value * 0.9)) THEN
      
      RAISE LOG '🚨 [BOT-INTERVENTION] Ativando bot para leilão "%" (ID: %): receita %.1f%% da meta, preço R$%.2f vs mercado R$%', 
        auction_record.title, auction_record.id, revenue_percentage, auction_record.current_price, auction_record.market_value;
      
      -- Obter bot
      SELECT public.get_random_bot() INTO bot_id;
      
      -- Inserir lance do bot
      INSERT INTO public.bids (auction_id, user_id, bid_amount, cost_paid)
      VALUES (auction_record.id, bot_id, auction_record.current_price + auction_record.bid_increment, auction_record.bid_cost);
      
      RAISE LOG '✅ [BOT-SUCCESS] Bot % executou lance no leilão %: novo preço R$%.2f', 
        bot_id, auction_record.id, (auction_record.current_price + auction_record.bid_increment);
        
    ELSE
      RAISE LOG '✋ [BOT-SKIP] Leilão % não precisa de intervenção: receita %.1f%% OK, preço R$%.2f OK', 
        auction_record.id, revenue_percentage, auction_record.current_price;
    END IF;
  END LOOP;
  
  RAISE LOG '🏁 [BOT-SYSTEM] Verificação automática concluída';
END;
$function$;

-- Fix #2: Corrigir função finalize_expired_auctions para respeitar metas

CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record RECORD;
  winner_user_id UUID;
  winner_display_name TEXT;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  current_revenue INTEGER;
  revenue_percentage DECIMAL;
  expired_count INTEGER := 0;
  protected_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔍 [FINALIZE] Verificando leilões expirados às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at,
      a.revenue_target,
      a.market_value,
      a.current_price
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - timezone('America/Sao_Paulo', last_bid_time)))::integer;
    
    -- Calcular receita atual para verificação de meta
    SELECT public.get_auction_revenue(auction_record.id) INTO current_revenue;
    
    IF auction_record.revenue_target > 0 THEN
      revenue_percentage := (current_revenue::decimal / auction_record.revenue_target::decimal) * 100;
    ELSE
      revenue_percentage := 100; -- Se não tem meta, considera 100%
    END IF;
    
    RAISE LOG '📊 [FINALIZE] Leilão "%": %s inativo, receita=%s/%s (%.1f%%), preço=R$%.2f, mercado=R$%', 
      auction_record.title, seconds_since_last_bid, current_revenue, auction_record.revenue_target,
      revenue_percentage, auction_record.current_price, auction_record.market_value;
    
    IF seconds_since_last_bid >= 15 THEN
      
      -- PROTEÇÃO: NÃO finalizar se meta não foi atingida E preço está baixo
      IF revenue_percentage < 80 AND 
         auction_record.market_value > 0 AND 
         auction_record.current_price < auction_record.market_value THEN
        
        RAISE LOG '🛡️ [PROTECTION] Leilão "%" PROTEGIDO de finalização: receita %.1f%% < 80%% E preço R$%.2f < mercado R$%', 
          auction_record.title, revenue_percentage, auction_record.current_price, auction_record.market_value;
        
        protected_count := protected_count + 1;
        CONTINUE;
      END IF;
      
      -- Verificação adicional de segurança contra lances recentes
      IF EXISTS (
        SELECT 1 FROM public.bids 
        WHERE auction_id = auction_record.id 
        AND created_at > brazil_now - INTERVAL '10 seconds'
      ) THEN
        RAISE LOG '🛡️ [FAILSAFE] Leilão "%" tem lances muito recentes - NÃO encerrando', 
          auction_record.title;
        CONTINUE;
      END IF;
      
      RAISE LOG '🏁 [FINALIZE] Encerrando leilão "%" - meta atingida ou critérios OK: receita %.1f%%, % segundos inativo', 
        auction_record.title, revenue_percentage, seconds_since_last_bid;
      
      -- Buscar ganhador
      SELECT b.user_id, p.full_name
      INTO winner_user_id, winner_display_name
      FROM public.bids b
      LEFT JOIN public.profiles p ON b.user_id = p.user_id
      WHERE b.auction_id = auction_record.id
      ORDER BY b.created_at DESC
      LIMIT 1;
      
      IF winner_display_name IS NOT NULL AND trim(winner_display_name) != '' THEN
        winner_display_name := winner_display_name;
      ELSIF winner_user_id IS NOT NULL THEN
        winner_display_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
      ELSE
        winner_display_name := 'Nenhum ganhador';
        winner_user_id := NULL;
      END IF;
      
      -- FINALIZAR LEILÃO
      UPDATE public.auctions
      SET 
        status = 'finished',
        time_left = 0,
        winner_id = winner_user_id,
        winner_name = winner_display_name,
        finished_at = brazil_now,
        updated_at = brazil_now
      WHERE id = auction_record.id;
      
      expired_count := expired_count + 1;
      
      RAISE LOG '✅ [FINALIZE] Leilão "%" encerrado! Ganhador: "%" (receita: %.1f%%, % segundos inativo)', 
        auction_record.title, winner_display_name, revenue_percentage, seconds_since_last_bid;
        
    ELSE
      RAISE LOG '⏰ [FINALIZE] Leilão "%" ainda ativo - apenas % segundos desde último lance', 
        auction_record.title, seconds_since_last_bid;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🔚 [FINALIZE] Verificação concluída: % leilões encerrados, % protegidos da finalização às % (BR)', 
    expired_count, protected_count, brazil_now;
END;
$function$;

-- Fix #3: Atualizar cron jobs para frequências mais seguras
-- Remover cron jobs antigos se existirem
SELECT cron.unschedule('auto-bid-system') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-bid-system');
SELECT cron.unschedule('finalize-auctions') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'finalize-auctions');

-- Criar novos cron jobs com timing otimizado
SELECT cron.schedule(
  'auto-bid-system',
  '*/3 * * * * *',  -- A cada 3 segundos (era 1s, muito agressivo)
  'SELECT public.auto_bid_system();'
);

SELECT cron.schedule(
  'finalize-auctions', 
  '*/10 * * * * *',  -- A cada 10 segundos (era 5s, dando mais tempo pros bots)
  'SELECT public.finalize_expired_auctions();'
);

-- Log de confirmação
DO $$
BEGIN
  RAISE LOG '🔧 [SYSTEM-UPDATE] Sistema de bots corrigido: janela expandida (0-15s), proteção de metas ativada, timing otimizado';
END $$;