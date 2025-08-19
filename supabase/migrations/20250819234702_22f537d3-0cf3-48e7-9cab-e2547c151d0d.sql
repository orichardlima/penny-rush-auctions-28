-- Corrigir a última função sem search_path

CREATE OR REPLACE FUNCTION public.auto_finalize_inactive_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  auction_record record;
  utc_now timestamptz;
  last_bid_time timestamptz;
  seconds_inactive integer;
BEGIN
  utc_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔍 [AUTO-FINALIZE] Iniciando verificação de leilões inativos (BR)';
  
  -- Buscar leilões ativos
  FOR auction_record IN 
    SELECT id, title, updated_at, status
    FROM public.auctions 
    WHERE status = 'active'
  LOOP
    
    -- Buscar último lance
    SELECT MAX(created_at) INTO last_bid_time
    FROM public.bids 
    WHERE auction_id = auction_record.id;
    
    -- Se não há lances, usar updated_at (quando virou active)
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
    END IF;
    
    -- Calcular segundos de inatividade
    seconds_inactive := EXTRACT(EPOCH FROM (utc_now - last_bid_time))::integer;
    
    RAISE LOG '🎯 [AUTO-FINALIZE] Leilão %: % segundos de inatividade', 
      auction_record.id, seconds_inactive;
    
    -- Se passou 15+ segundos, encerrar
    IF seconds_inactive >= 15 THEN
      
      DECLARE
        winner_user_id uuid;
        winner_name text;
      BEGIN
        -- Encontrar ganhador (último lance)
        SELECT b.user_id, p.full_name
        INTO winner_user_id, winner_name
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = auction_record.id
        ORDER BY b.created_at DESC
        LIMIT 1;
        
        -- Definir nome do ganhador
        IF winner_name IS NOT NULL AND trim(winner_name) != '' THEN
          winner_name := winner_name;
        ELSIF winner_user_id IS NOT NULL THEN
          winner_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
        ELSE
          winner_name := 'Nenhum ganhador';
        END IF;
        
        -- ENCERRAR LEILÃO
        UPDATE public.auctions
        SET 
          status = 'finished',
          time_left = 0,
          winner_id = winner_user_id,
          winner_name = winner_name,
          finished_at = utc_now,
          updated_at = utc_now
        WHERE id = auction_record.id;
        
        RAISE LOG '✅ [AUTO-FINALIZE] Leilão % ENCERRADO! Ganhador: % (% segundos inativo)', 
          auction_record.id, winner_name, seconds_inactive;
      END;
      
    END IF;
    
  END LOOP;
  
  RAISE LOG '🏁 [AUTO-FINALIZE] Verificação concluída (BR)';
END;
$function$;