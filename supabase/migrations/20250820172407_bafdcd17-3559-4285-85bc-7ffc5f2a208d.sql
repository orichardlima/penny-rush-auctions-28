-- Corrigir função de finalização de leilões para lidar com timers travados
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
  
  RAISE LOG '🔍 [FINALIZE-FIXED] Verificando leilões para finalização às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at,
      a.ends_at,
      a.time_left
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    -- REGRA 1: Se ends_at passou, finalizar IMEDIATAMENTE (prioritário)
    IF auction_record.ends_at IS NOT NULL AND brazil_now > auction_record.ends_at THEN
      
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
      
      -- FINALIZAR LEILÃO IMEDIATAMENTE
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
      
      RAISE LOG '⚡ [FINALIZE-FIXED] Leilão "%" FINALIZADO (ends_at expirado)! Ganhador: "%"', 
        auction_record.title, winner_display_name;
        
    -- REGRA 2: Se timer=0 e passou 20+ segundos, finalizar (secundário)
    ELSIF auction_record.time_left <= 0 THEN
      
      -- Buscar último lance
      SELECT MAX(b.created_at) INTO last_bid_time
      FROM public.bids b
      WHERE b.auction_id = auction_record.id;
      
      IF last_bid_time IS NULL THEN
        last_bid_time := auction_record.updated_at;
      END IF;
      
      seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - last_bid_time))::integer;
      
      IF seconds_since_last_bid >= 20 THEN
        
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
        
        finalized_count := finalized_count + 1;
        
        RAISE LOG '⏰ [FINALIZE-FIXED] Leilão "%" finalizado (20s inativo)! Ganhador: "%"', 
          auction_record.title, winner_display_name;
      ELSE
        RAISE LOG '⏳ [FINALIZE-FIXED] Leilão "%" aguardando: %s de %s necessários', 
          auction_record.title, seconds_since_last_bid, 20;
      END IF;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🏁 [FINALIZE-FIXED] Finalização corrigida concluída: % leilões finalizados às % (BR)', 
    finalized_count, brazil_now;
END;
$function$;

-- Executar finalização imediatamente para corrigir leilões travados
SELECT public.finalize_expired_auctions();