-- PLANO DE CORREÇÃO COMPLETA DO SISTEMA DE LEILÕES
-- FASE 1: Remover cron jobs problemáticos
SELECT cron.unschedule('finalize-expired-auctions');
SELECT cron.unschedule('fix-stuck-auctions');
SELECT cron.unschedule('sync-auction-timers');

-- FASE 2: Criar nova função unificada que usa APENAS inatividade de lances
CREATE OR REPLACE FUNCTION public.finalize_auctions_by_inactivity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record RECORD;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  finalized_count INTEGER := 0;
  winner_user_id UUID;
  winner_display_name TEXT;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔍 [INACTIVITY-FINALIZE] Verificando leilões por inatividade às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    -- Buscar último lance (ÚNICA fonte de verdade)
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    -- Se não há lances, usar updated_at (quando virou active)
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    -- Calcular inatividade em horário brasileiro
    seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
    
    RAISE LOG '⏱️ [INACTIVITY-CHECK] Leilão "%" (ID: %): %s de inatividade', 
      auction_record.title, auction_record.id, seconds_since_last_bid;
    
    -- ÚNICA REGRA: 15+ segundos de inatividade
    IF seconds_since_last_bid >= 15 THEN
      
      -- Buscar ganhador (último lance)
      SELECT b.user_id, p.full_name
      INTO winner_user_id, winner_display_name
      FROM public.bids b
      LEFT JOIN public.profiles p ON b.user_id = p.user_id
      WHERE b.auction_id = auction_record.id
      ORDER BY b.created_at DESC
      LIMIT 1;
      
      -- Definir nome do ganhador
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
      
      finalized_count := finalized_count + 1;
      
      RAISE LOG '✅ [INACTIVITY-FINALIZED] Leilão "%" finalizado! Ganhador: "%" (%s de inatividade)', 
        auction_record.title, winner_display_name, seconds_since_last_bid;
    ELSE
      RAISE LOG '⏳ [INACTIVITY-WAIT] Leilão "%" aguardando: %s de %s necessários', 
        auction_record.title, seconds_since_last_bid, 15;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🏁 [INACTIVITY-FINALIZE] Finalização concluída: % leilões finalizados às % (BR)', 
    finalized_count, brazil_now;
END;
$function$;

-- FASE 3: Ajustar função de sincronização de timers (SEM FINALIZAÇÃO)
CREATE OR REPLACE FUNCTION public.sync_auction_timers_visual()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record RECORD;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  visual_ends_at TIMESTAMPTZ;
  visual_time_left INTEGER;
  updated_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔧 [SYNC-VISUAL] Sincronizando timers visuais às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title,
      a.ends_at,
      a.time_left,
      a.updated_at
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    -- Buscar último lance para calcular timer VISUAL
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    -- Se não há lances, usar updated_at
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    -- Calcular ends_at VISUAL: último lance + 15 segundos
    visual_ends_at := last_bid_time + INTERVAL '15 seconds';
    
    -- Calcular time_left VISUAL baseado no visual_ends_at
    visual_time_left := GREATEST(0, EXTRACT(EPOCH FROM (visual_ends_at - brazil_now))::integer);
    
    -- Atualizar APENAS se mudou (campos VISUAIS)
    IF auction_record.ends_at IS DISTINCT FROM visual_ends_at OR 
       auction_record.time_left IS DISTINCT FROM visual_time_left THEN
      
      UPDATE public.auctions
      SET 
        ends_at = visual_ends_at,
        time_left = visual_time_left,
        updated_at = brazil_now
      WHERE id = auction_record.id;
      
      updated_count := updated_count + 1;
      
      RAISE LOG '🔧 [SYNC-UPDATED] Leilão "%" atualizado: time_left=% (VISUAL)', 
        auction_record.title, visual_time_left;
    END IF;
    
  END LOOP;
  
  RAISE LOG '🏁 [SYNC-VISUAL] Sincronização visual concluída: % leilões atualizados às % (BR)', 
    updated_count, brazil_now;
END;
$function$;

-- FASE 4: Ajustar trigger de atualizacao de lances (SEM LOGICA DE FINALIZACAO)
CREATE OR REPLACE FUNCTION public.update_auction_stats_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  brazil_now timestamptz;
  visual_ends_at timestamptz;
  is_bot_user boolean := false;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  visual_ends_at := brazil_now + INTERVAL '15 seconds';
  
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      ends_at = visual_ends_at,  -- VISUAL APENAS
      time_left = 15,            -- VISUAL APENAS
      updated_at = brazil_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer visual reset para 15s', NEW.auction_id;
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      ends_at = visual_ends_at,  -- VISUAL APENAS
      time_left = 15,            -- VISUAL APENAS
      updated_at = brazil_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: timer visual reset para 15s, receita +R$%.2f', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- FASE 5: Simplificar trigger de prevencao (SEM DEPENDENCIA DE ends_at)
CREATE OR REPLACE FUNCTION public.prevent_premature_finalization_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  brazil_now TIMESTAMPTZ;
BEGIN
  -- Só verificar se está mudando para 'finished'
  IF OLD.status IS DISTINCT FROM 'finished' AND NEW.status = 'finished' THEN
    
    brazil_now := timezone('America/Sao_Paulo', now());
    
    -- Buscar último lance
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = NEW.id;
    
    IF last_bid_time IS NOT NULL THEN
      seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
      
      -- BLOQUEAR se há menos de 15 segundos de inatividade
      IF seconds_since_last_bid < 15 THEN
        RAISE EXCEPTION 'PROTEÇÃO: Leilão % não pode ser finalizado com apenas %s de inatividade (mínimo 15s)', 
          NEW.id, seconds_since_last_bid;
      END IF;
      
      RAISE LOG '✅ [PROTECTION-OK] Leilão % finalizado corretamente com %s de inatividade', 
        NEW.id, seconds_since_last_bid;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- FASE 6: Remover triggers antigos e criar novos
DROP TRIGGER IF EXISTS update_auction_stats_trigger ON public.bids;
DROP TRIGGER IF EXISTS prevent_premature_finalization_trigger ON public.auctions;

CREATE TRIGGER update_auction_stats_simple_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats_simple();

CREATE TRIGGER prevent_premature_finalization_simple_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_premature_finalization_simple();

-- FASE 7: Criar ÚNICO cron job para finalização por inatividade
SELECT cron.schedule(
  'finalize-auctions-by-inactivity',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT public.finalize_auctions_by_inactivity();
  $$
);

-- Cron job para sincronização visual (mais frequente)
SELECT cron.schedule(
  'sync-visual-timers',
  '*/2 * * * *', -- A cada 2 minutos
  $$
  SELECT public.sync_auction_timers_visual();
  $$
);

-- Comentário final
COMMENT ON FUNCTION public.finalize_auctions_by_inactivity() IS 'ÚNICA função de finalização - usa APENAS inatividade de 15 segundos de lances';
COMMENT ON FUNCTION public.sync_auction_timers_visual() IS 'Sincronização de timers VISUAIS - não finaliza leilões';
COMMENT ON FUNCTION public.update_auction_stats_simple() IS 'Atualização simples de estatísticas - não finaliza leilões';
COMMENT ON FUNCTION public.prevent_premature_finalization_simple() IS 'Proteção simples - bloqueia finalização com menos de 15s de inatividade';