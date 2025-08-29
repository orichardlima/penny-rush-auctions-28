-- Função para detectar e corrigir leilões agarrados
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
  
  -- Detectar leilões agarrados: status active + time_left <= 0 + ends_at no passado há mais de 1 minuto
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
      AND (a.time_left <= 0 OR a.ends_at <= brazil_now - INTERVAL '1 minute')
  LOOP
    
    -- Calcular há quanto tempo está agarrado
    seconds_stuck := EXTRACT(EPOCH FROM (brazil_now - auction_record.ends_at))::integer;
    
    RAISE LOG '🎯 [FIX-STUCK] Leilão agarrado detectado: "%" (ID: %) - agarrado há %s', 
      auction_record.title, auction_record.id, seconds_stuck;
    
    -- Buscar último lance para determinar ganhador
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
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
    
    -- FORÇAR FINALIZAÇÃO DO LEILÃO AGARRADO
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

-- Adicionar ao cron job para executar a cada 5 minutos
SELECT cron.schedule(
  'fix-stuck-auctions',
  '*/5 * * * *', -- A cada 5 minutos
  'SELECT public.fix_stuck_auctions();'
);