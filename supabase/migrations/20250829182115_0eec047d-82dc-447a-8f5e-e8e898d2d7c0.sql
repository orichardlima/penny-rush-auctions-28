-- CORREÇÃO COMPLETA DO SISTEMA DE FINALIZAÇÃO
-- Regra de Ouro: Leilões só podem ser finalizados por inatividade de lances (15+ segundos sem lance)

-- 1. CORRIGIR update_auction_stats() para consistência de timer
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  brazil_now timestamptz;
  new_ends_at timestamptz;
  is_bot_user boolean := false;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  new_ends_at := brazil_now + INTERVAL '15 seconds'; -- CORRIGIDO: 15 segundos (não 16)
  
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      ends_at = new_ends_at,
      time_left = 15,
      updated_at = brazil_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer reset para 15s, ends_at=% (BR)', 
      NEW.auction_id, new_ends_at;
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      ends_at = new_ends_at,
      time_left = 15,
      updated_at = brazil_now
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: timer reset para 15s, ends_at=% (BR), receita +R$%.2f', 
      NEW.auction_id, new_ends_at, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. REESCREVER finalize_expired_auctions() COM PRIMEIRA REGRA ÚNICA
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
  finalized_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔍 [FINALIZE-CORRECTED] CORREÇÃO: Verificando leilões APENAS por inatividade de lances às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at,
      a.time_left
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    -- REGRA ÚNICA: Só finalizar se time_left = 0 E sem lances há 15+ segundos
    IF auction_record.time_left <= 0 THEN
      
      -- Buscar último lance
      SELECT MAX(b.created_at) INTO last_bid_time
      FROM public.bids b
      WHERE b.auction_id = auction_record.id;
      
      -- Se não há lances, usar updated_at (quando virou active)
      IF last_bid_time IS NULL THEN
        last_bid_time := auction_record.updated_at;
      END IF;
      
      seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
      
      RAISE LOG '⏱️ [FINALIZE-CHECK] Leilão "%" (ID: %): time_left=%, inativo_há=%s', 
        auction_record.title, auction_record.id, auction_record.time_left, seconds_since_last_bid;
      
      -- ÚNICA CONDIÇÃO: 15+ segundos de inatividade
      IF seconds_since_last_bid >= 15 THEN
        
        -- Buscar ganhador
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
        
        RAISE LOG '✅ [FINALIZE-SUCCESS] Leilão "%" FINALIZADO! Ganhador: "%" (inativo há %s)', 
          auction_record.title, winner_display_name, seconds_since_last_bid;
      ELSE
        RAISE LOG '⏳ [FINALIZE-WAIT] Leilão "%" aguardando inatividade: %s de 15s necessários', 
          auction_record.title, seconds_since_last_bid;
      END IF;
      
    ELSE
      RAISE LOG '🔄 [FINALIZE-ACTIVE] Leilão "%" ainda ativo: time_left=%s', 
        auction_record.title, auction_record.time_left;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🏁 [FINALIZE-CORRECTED] CORREÇÃO: Finalização concluída: % leilões finalizados às % (BR)', 
    finalized_count, brazil_now;
END;
$function$;

-- 3. IMPLEMENTAR sync_auction_timers() para correção automática
CREATE OR REPLACE FUNCTION public.sync_auction_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record RECORD;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  corrected_ends_at TIMESTAMPTZ;
  corrected_time_left INTEGER;
  corrected_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔧 [SYNC-TIMERS] Iniciando correção automática de timers às % (BR)', brazil_now;
  
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
    
    -- Buscar último lance
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    -- Se não há lances, usar updated_at (quando virou active)
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    -- Calcular ends_at correto: último lance + 15 segundos
    corrected_ends_at := last_bid_time + INTERVAL '15 seconds';
    
    -- Calcular time_left correto baseado no ends_at
    corrected_time_left := GREATEST(0, EXTRACT(EPOCH FROM (corrected_ends_at - brazil_now))::integer);
    
    -- Verificar se precisa corrigir
    IF auction_record.ends_at IS DISTINCT FROM corrected_ends_at OR 
       auction_record.time_left IS DISTINCT FROM corrected_time_left THEN
      
      -- CORRIGIR DADOS
      UPDATE public.auctions
      SET 
        ends_at = corrected_ends_at,
        time_left = corrected_time_left,
        updated_at = brazil_now
      WHERE id = auction_record.id;
      
      corrected_count := corrected_count + 1;
      
      RAISE LOG '🔧 [SYNC-CORRECTED] Leilão "%" corrigido: ends_at % → %, time_left % → %', 
        auction_record.title, auction_record.ends_at, corrected_ends_at, 
        auction_record.time_left, corrected_time_left;
    END IF;
    
  END LOOP;
  
  RAISE LOG '🏁 [SYNC-TIMERS] Correção concluída: % leilões corrigidos às % (BR)', 
    corrected_count, brazil_now;
END;
$function$;

-- 4. IMPLEMENTAR sistema de emergência para ressuscitar leilões
CREATE OR REPLACE FUNCTION public.resurrect_incorrectly_finished_auctions()
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
  resurrected_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🚨 [RESURRECT] Verificando leilões finalizados incorretamente às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title,
      a.finished_at
    FROM public.auctions a
    WHERE a.status = 'finished'
      AND a.finished_at > brazil_now - INTERVAL '5 minutes' -- Apenas últimos 5 minutos
  LOOP
    
    -- Buscar último lance
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    IF last_bid_time IS NOT NULL THEN
      seconds_since_last_bid := EXTRACT(EPOCH FROM (auction_record.finished_at - last_bid_time))::integer;
      
      -- Se foi finalizado com menos de 15 segundos de inatividade, RESSUSCITAR
      IF seconds_since_last_bid < 15 THEN
        
        -- RESSUSCITAR LEILÃO
        UPDATE public.auctions
        SET 
          status = 'active',
          time_left = GREATEST(1, 15 - EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer),
          ends_at = last_bid_time + INTERVAL '15 seconds',
          winner_id = NULL,
          winner_name = NULL,
          finished_at = NULL,
          updated_at = brazil_now
        WHERE id = auction_record.id;
        
        resurrected_count := resurrected_count + 1;
        
        RAISE LOG '🔄 [RESURRECT-SUCCESS] Leilão "%" RESSUSCITADO! Foi finalizado com apenas %s de inatividade', 
          auction_record.title, seconds_since_last_bid;
      END IF;
    END IF;
    
  END LOOP;
  
  RAISE LOG '🏁 [RESURRECT] Ressurreição concluída: % leilões ressuscitados às % (BR)', 
    resurrected_count, brazil_now;
END;
$function$;

-- 5. ADICIONAR trigger de proteção contra finalização prematura
CREATE OR REPLACE FUNCTION public.prevent_premature_finalization()
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

-- Criar trigger de proteção
DROP TRIGGER IF EXISTS prevent_premature_finalization_trigger ON public.auctions;
CREATE TRIGGER prevent_premature_finalization_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_premature_finalization();