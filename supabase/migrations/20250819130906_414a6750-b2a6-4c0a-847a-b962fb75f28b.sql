-- Corrigir função finalize_expired_auctions para usar último lance em vez de updated_at
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
  utc_now TIMESTAMPTZ;
  last_bid_time TIMESTAMPTZ;
  seconds_since_last_bid INTEGER;
  expired_count INTEGER := 0;
BEGIN
  utc_now := NOW();
  
  RAISE LOG '🔍 [FINALIZE] Verificando leilões expirados às %', utc_now;
  
  -- Buscar leilões ativos e verificar último lance para cada um
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    -- Buscar timestamp do último lance (não updated_at do auction)
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    -- Se não há lances, usar updated_at do auction (quando virou active)
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
      RAISE LOG '⚠️ [FINALIZE] Leilão % sem lances - usando updated_at: %', 
        auction_record.id, last_bid_time;
    END IF;
    
    -- Calcular segundos desde o último lance
    seconds_since_last_bid := EXTRACT(EPOCH FROM (utc_now - last_bid_time))::integer;
    
    RAISE LOG '🎯 [FINALIZE] Leilão %: último lance há % segundos (às %)', 
      auction_record.id, seconds_since_last_bid, last_bid_time;
    
    -- Só encerrar se passou 15+ segundos desde o ÚLTIMO LANCE (não updated_at)
    IF seconds_since_last_bid >= 15 THEN
      
      -- FAILSAFE: Verificação dupla - buscar lances muito recentes (últimos 10 segundos)
      IF EXISTS (
        SELECT 1 FROM public.bids 
        WHERE auction_id = auction_record.id 
        AND created_at > utc_now - INTERVAL '10 seconds'
      ) THEN
        RAISE LOG '🛡️ [FAILSAFE] Leilão % tem lances recentes - NÃO encerrando', 
          auction_record.id;
        CONTINUE;
      END IF;
      
      RAISE LOG '🏁 [FINALIZE] Encerrando leilão % ("%") - % segundos desde último lance', 
        auction_record.id, auction_record.title, seconds_since_last_bid;
      
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
      
      -- ENCERRAR LEILÃO DEFINITIVAMENTE
      UPDATE public.auctions
      SET 
        status = 'finished',
        time_left = 0,
        winner_id = winner_user_id,
        winner_name = winner_display_name,
        finished_at = utc_now,
        updated_at = utc_now
      WHERE id = auction_record.id;
      
      expired_count := expired_count + 1;
      
      RAISE LOG '✅ [FINALIZE] Leilão % encerrado! Ganhador: "%" (% segundos desde último lance às %)', 
        auction_record.id, winner_display_name, seconds_since_last_bid, last_bid_time;
        
    ELSE
      RAISE LOG '⏰ [FINALIZE] Leilão % ainda ativo - apenas % segundos desde último lance', 
        auction_record.id, seconds_since_last_bid;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🔚 [FINALIZE] Verificação concluída. % leilões encerrados às %', expired_count, utc_now;
END;
$function$;