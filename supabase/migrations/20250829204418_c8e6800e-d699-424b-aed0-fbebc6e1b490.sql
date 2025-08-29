-- Remover o cron job anterior se existir
SELECT cron.unschedule('fix-stuck-auctions');

-- Modificar o trigger de proteção para permitir correções de leilões agarrados
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
  stuck_threshold INTEGER := 300; -- 5 minutos para considerar agarrado
BEGIN
  -- Só verificar se está mudando para 'finished'
  IF OLD.status IS DISTINCT FROM 'finished' AND NEW.status = 'finished' THEN
    
    brazil_now := timezone('America/Sao_Paulo', now());
    
    -- EXCEÇÃO: Se o leilão está agarrado há mais de 5 minutos, permitir finalização
    IF NEW.ends_at <= brazil_now - INTERVAL '5 minutes' THEN
      RAISE LOG '🚨 [PROTECTION-BYPASS] Leilão % liberado para finalização (agarrado há mais de 5min)', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Buscar último lance
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = NEW.id;
    
    IF last_bid_time IS NOT NULL THEN
      seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
      
      -- BLOQUEAR se há menos de 15 segundos de inatividade (proteção normal)
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

-- Função melhorada para corrigir leilões agarrados
CREATE OR REPLACE FUNCTION public.fix_stuck_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record RECORD;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  seconds_stuck INTEGER;
  fixed_count INTEGER := 0;
  winner_user_id UUID;
  winner_display_name TEXT;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🚨 [FIX-STUCK] Iniciando correção de leilões agarrados às % (BR)', brazil_now;
  
  -- Detectar leilões agarrados: status active + ends_at no passado há mais de 5 minutos
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.time_left,
      a.ends_at,
      a.updated_at,
      a.status
    FROM public.auctions a
    WHERE a.status = 'active'
      AND a.ends_at <= brazil_now - INTERVAL '5 minutes'
  LOOP
    
    -- Calcular há quanto tempo está agarrado
    seconds_stuck := EXTRACT(EPOCH FROM (brazil_now - auction_record.ends_at))::integer;
    
    RAISE LOG '🎯 [FIX-STUCK] Leilão agarrado detectado: "%" (ID: %) - agarrado há %s', 
      auction_record.title, auction_record.id, seconds_stuck;
    
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
    
    -- FORÇAR FINALIZAÇÃO DO LEILÃO AGARRADO (agora vai passar pela proteção)
    UPDATE public.auctions
    SET 
      status = 'finished',
      time_left = 0,
      winner_id = winner_user_id,
      winner_name = winner_display_name,
      finished_at = brazil_now,
      updated_at = brazil_now
    WHERE id = auction_record.id;
    
    fixed_count := fixed_count + 1;
    
    RAISE LOG '✅ [FIX-STUCK] Leilão "%" DESBLOQUEADO! Ganhador: "%" (agarrado há %s)', 
      auction_record.title, winner_display_name, seconds_stuck;
    
  END LOOP;
  
  RAISE LOG '🏁 [FIX-STUCK] Correção concluída: % leilões desbloqueados às % (BR)', 
    fixed_count, brazil_now;
END;
$function$;

-- Executar a correção imediatamente
SELECT public.fix_stuck_auctions();

-- Adicionar ao cron job para executar a cada 10 minutos
SELECT cron.schedule(
  'fix-stuck-auctions',
  '*/10 * * * *', -- A cada 10 minutos
  'SELECT public.fix_stuck_auctions();'
);