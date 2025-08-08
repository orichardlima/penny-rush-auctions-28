-- Ensure function exists with correct security and search_path
CREATE OR REPLACE FUNCTION public.finish_auction_when_timer_ends()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    last_bidder_record RECORD;
    winner_name TEXT;
BEGIN
    -- Só executa se o status mudou para finalizado ou se time_left chegou a 0
    IF (NEW.status = 'finished' OR NEW.time_left <= 0) AND OLD.status = 'active' THEN
        -- Buscar o último lance (ganhador)
        SELECT b.*, p.display_name, p.user_id
        INTO last_bidder_record
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = NEW.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador
        IF last_bidder_record.display_name IS NOT NULL THEN
            winner_name := last_bidder_record.display_name;
        ELSE
            winner_name := 'Usuário ' || SUBSTRING(last_bidder_record.user_id::text FROM 1 FOR 8);
        END IF;

        -- Atualizar o leilão com status finalizado e ganhador
        UPDATE public.auctions 
        SET 
            status = 'finished',
            time_left = 0,
            winner_id = last_bidder_record.user_id,
            winner_name = winner_name,
            finished_at = NOW()
        WHERE id = NEW.id;

        -- Log para debug
        RAISE LOG 'Auction % finished. Winner: % (ID: %)', NEW.id, winner_name, last_bidder_record.user_id;
    END IF;

    RETURN NEW;
END;
$function$;

-- Create trigger to finalize immediately when timer hits zero or status becomes finished
DROP TRIGGER IF EXISTS trigger_finish_auction_on_timer_end ON public.auctions;

CREATE TRIGGER trigger_finish_auction_on_timer_end
AFTER UPDATE OF time_left, status ON public.auctions
FOR EACH ROW
WHEN (
  (NEW.status = 'active' AND NEW.time_left <= 0)
  OR
  (NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished'))
)
EXECUTE FUNCTION public.finish_auction_when_timer_ends();