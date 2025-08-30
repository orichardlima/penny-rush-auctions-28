-- CORRIGIR PROBLEMA CRÍTICO: Trigger de proteção está calculando mal a inatividade
-- O erro "-9493s de inatividade" mostra que o cálculo está invertido

-- 1. Desabilitar trigger problemático temporariamente
DROP TRIGGER IF EXISTS prevent_premature_finalization_trigger ON public.auctions;

-- 2. Recriar função com cálculo correto de inatividade
CREATE OR REPLACE FUNCTION public.prevent_premature_finalization_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  now_utc TIMESTAMPTZ;
BEGIN
  -- Só verificar se está mudando para 'finished'
  IF OLD.status IS DISTINCT FROM 'finished' AND NEW.status = 'finished' THEN
    
    now_utc := now(); -- UTC atual
    
    -- Buscar último lance
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = NEW.id;
    
    IF last_bid_time IS NOT NULL THEN
      -- CORREÇÃO CRÍTICA: Cálculo correto da inatividade
      seconds_since_last_bid := EXTRACT(EPOCH FROM (now_utc - last_bid_time))::integer;
      
      -- Log detalhado para debug
      RAISE LOG '🔍 [PROTECTION-DEBUG] Leilão %: now_utc=%, last_bid=%, diff=%s', 
        NEW.id, now_utc, last_bid_time, seconds_since_last_bid;
      
      -- BLOQUEAR apenas se há menos de 15 segundos de inatividade REAL
      IF seconds_since_last_bid < 15 THEN
        RAISE EXCEPTION 'PROTEÇÃO: Leilão % não pode ser finalizado com apenas %s de inatividade (mínimo 15s)', 
          NEW.id, seconds_since_last_bid;
      END IF;
      
      RAISE LOG '✅ [PROTECTION-OK] Leilão % finalizado corretamente com %s de inatividade', 
        NEW.id, seconds_since_last_bid;
    ELSE
      -- Se não há lances, permitir finalização
      RAISE LOG '✅ [PROTECTION-OK] Leilão % finalizado (sem lances)', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Recriar trigger com função corrigida
CREATE TRIGGER prevent_premature_finalization_trigger_fixed
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_premature_finalization_fixed();

-- 4. Forçar finalização de leilões presos (mais de 5 minutos inativos)
UPDATE public.auctions
SET 
  status = 'finished',
  time_left = 0,
  finished_at = now(),
  updated_at = now(),
  winner_name = COALESCE(
    (SELECT p.full_name 
     FROM public.bids b 
     JOIN public.profiles p ON b.user_id = p.user_id 
     WHERE b.auction_id = auctions.id 
     ORDER BY b.created_at DESC 
     LIMIT 1),
    'Nenhum ganhador'
  ),
  winner_id = (
    SELECT b.user_id 
    FROM public.bids b 
    WHERE b.auction_id = auctions.id 
    ORDER BY b.created_at DESC 
    LIMIT 1
  )
WHERE status = 'active' 
AND updated_at < now() - INTERVAL '5 minutes';