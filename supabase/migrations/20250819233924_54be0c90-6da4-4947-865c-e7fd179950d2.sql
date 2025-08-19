-- Corrigir search_path nas funções criadas/modificadas na migração anterior
CREATE OR REPLACE FUNCTION public.set_auction_end_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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