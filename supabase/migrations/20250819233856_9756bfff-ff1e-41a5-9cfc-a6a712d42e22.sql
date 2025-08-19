-- Configurar timezone global do banco para fuso brasileiro
SET timezone TO 'America/Sao_Paulo';

-- Função para obter hora atual do servidor em fuso brasileiro
CREATE OR REPLACE FUNCTION public.current_server_time()
RETURNS timestamp with time zone
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT timezone('America/Sao_Paulo', now());
$function$;

-- Atualizar função de finalização para usar fuso brasileiro
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
  expired_count INTEGER := 0;
BEGIN
  brazil_now := timezone('America/Sao_Paulo', now());
  
  RAISE LOG '🔍 [FINALIZE] Verificando leilões expirados às % (BR)', brazil_now;
  
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at
    FROM public.auctions a
    WHERE a.status = 'active'
  LOOP
    
    SELECT MAX(b.created_at) INTO last_bid_time
    FROM public.bids b
    WHERE b.auction_id = auction_record.id;
    
    IF last_bid_time IS NULL THEN
      last_bid_time := auction_record.updated_at;
      RAISE LOG '⚠️ [FINALIZE] Leilão % sem lances - usando updated_at: % (BR)', 
        auction_record.id, timezone('America/Sao_Paulo', last_bid_time);
    END IF;
    
    seconds_since_last_bid := EXTRACT(EPOCH FROM (brazil_now - timezone('America/Sao_Paulo', last_bid_time)))::integer;
    
    RAISE LOG '🎯 [FINALIZE] Leilão %: último lance há % segundos (às % BR)', 
      auction_record.id, seconds_since_last_bid, timezone('America/Sao_Paulo', last_bid_time);
    
    IF seconds_since_last_bid >= 15 THEN
      
      IF EXISTS (
        SELECT 1 FROM public.bids 
        WHERE auction_id = auction_record.id 
        AND created_at > brazil_now - INTERVAL '10 seconds'
      ) THEN
        RAISE LOG '🛡️ [FAILSAFE] Leilão % tem lances recentes - NÃO encerrando', 
          auction_record.id;
        CONTINUE;
      END IF;
      
      RAISE LOG '🏁 [FINALIZE] Encerrando leilão % ("%") - % segundos desde último lance', 
        auction_record.id, auction_record.title, seconds_since_last_bid;
      
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
      
      RAISE LOG '✅ [FINALIZE] Leilão % encerrado! Ganhador: "%" (% segundos desde último lance às % BR)', 
        auction_record.id, winner_display_name, seconds_since_last_bid, timezone('America/Sao_Paulo', last_bid_time);
        
    ELSE
      RAISE LOG '⏰ [FINALIZE] Leilão % ainda ativo - apenas % segundos desde último lance', 
        auction_record.id, seconds_since_last_bid;
    END IF;
      
  END LOOP;
  
  RAISE LOG '🔚 [FINALIZE] Verificação concluída. % leilões encerrados às % (BR)', expired_count, brazil_now;
END;
$function$;

-- Atualizar função de ativação de leilões para usar fuso brasileiro
CREATE OR REPLACE FUNCTION public.set_auction_end_time()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' AND NEW.ends_at IS NULL THEN
    NEW.ends_at := timezone('America/Sao_Paulo', now()) + INTERVAL '15 seconds';
    NEW.time_left := 15;
    NEW.updated_at := timezone('America/Sao_Paulo', now());
    
    RAISE LOG 'Auction % activated: ends_at set to % (BR), time_left set to 15', 
      NEW.id, NEW.ends_at;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função de update de stats para usar fuso brasileiro
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
  new_ends_at := brazil_now + INTERVAL '16 seconds';
  
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
    
    RAISE LOG 'Bot bid placed on auction %: timer reset to 15 seconds, ends_at set to % (BR), NO revenue added', 
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
    
    RAISE LOG 'User bid placed on auction %: timer reset to 15 seconds, ends_at set to % (BR), revenue increased by R$%.2f', 
      NEW.auction_id, new_ends_at, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função de log de mudança de status
CREATE OR REPLACE FUNCTION public.log_auction_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE LOG 'Auction % status changed from "%" to "%" at % (BR)', 
      NEW.id, COALESCE(OLD.status, 'NULL'), NEW.status, timezone('America/Sao_Paulo', now());
  END IF;
  
  RETURN NEW;
END;
$function$;