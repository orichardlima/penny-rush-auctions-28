-- Atualizar função de finalização por inatividade para incluir cidade/estado
CREATE OR REPLACE FUNCTION public.finalize_auctions_by_inactivity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  auction_record RECORD;
  brazil_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  finalized_count INTEGER := 0;
  winner_user_id UUID;
  winner_display_name TEXT;
  winner_city TEXT;
  winner_state TEXT;
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
      
      -- Buscar ganhador (último lance) com dados completos
      SELECT b.user_id, p.full_name, p.city, p.state
      INTO winner_user_id, winner_display_name, winner_city, winner_state
      FROM public.bids b
      LEFT JOIN public.profiles p ON b.user_id = p.user_id
      WHERE b.auction_id = auction_record.id
      ORDER BY b.created_at DESC
      LIMIT 1;
      
      -- Definir nome do ganhador com localização
      IF winner_display_name IS NOT NULL AND trim(winner_display_name) != '' THEN
        -- Se tem cidade e estado, incluir na exibição
        IF winner_city IS NOT NULL AND winner_state IS NOT NULL AND 
           trim(winner_city) != '' AND trim(winner_state) != '' THEN
          winner_display_name := winner_display_name || ' - ' || winner_city || ', ' || winner_state;
        END IF;
      ELSIF winner_user_id IS NOT NULL THEN
        winner_display_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
        -- Para usuários anônimos, não temos cidade/estado
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