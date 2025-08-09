-- 1) Corrigir a função de finalização (usa profiles.full_name)
CREATE OR REPLACE FUNCTION public.finish_auction_when_timer_ends()
RETURNS trigger
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
        SELECT b.*, p.full_name, p.user_id
        INTO last_bidder_record
        FROM public.bids b
        LEFT JOIN public.profiles p ON b.user_id = p.user_id
        WHERE b.auction_id = NEW.id
        ORDER BY b.created_at DESC
        LIMIT 1;

        -- Definir nome do ganhador (full_name, se existir)
        IF last_bidder_record.full_name IS NOT NULL AND length(trim(last_bidder_record.full_name)) > 0 THEN
            winner_name := last_bidder_record.full_name;
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

-- 2) Triggers para garantir consistência
-- 2.1) Bids: impedir lances em leilões inativos/finalizados (antes de inserir)
DROP TRIGGER IF EXISTS tr_bids_before_insert_prevent ON public.bids;
CREATE TRIGGER tr_bids_before_insert_prevent
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bids_on_inactive_auctions();

-- 2.2) Bids: atualizar estatísticas do leilão (após inserir)
DROP TRIGGER IF EXISTS tr_bids_after_insert_update_stats ON public.bids;
CREATE TRIGGER tr_bids_after_insert_update_stats
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.update_auction_stats();

-- 2.3) Auctions: impedir reativar/alterar timer de leilões finalizados
DROP TRIGGER IF EXISTS tr_auctions_before_update_lock_finished ON public.auctions;
CREATE TRIGGER tr_auctions_before_update_lock_finished
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.lock_finished_auctions();

-- 2.4) Auctions: webhook ao ativar leilão
DROP TRIGGER IF EXISTS tr_auctions_after_update_webhook ON public.auctions;
CREATE TRIGGER tr_auctions_after_update_webhook
AFTER UPDATE OF status ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auction_webhook();

-- 2.5) Auctions: intervenção de bot quando timer baixo e meta não atingida
DROP TRIGGER IF EXISTS tr_auctions_after_update_bot_intervention ON public.auctions;
CREATE TRIGGER tr_auctions_after_update_bot_intervention
AFTER UPDATE OF time_left ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.check_bot_intervention();

-- 2.6) Auctions: finalizar quando timer zerar ou status mudar para finished
DROP TRIGGER IF EXISTS tr_auctions_after_update_finish ON public.auctions;
CREATE TRIGGER tr_auctions_after_update_finish
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.finish_auction_when_timer_ends();

-- 2.7) Auctions: manter updated_at sempre atualizado
DROP TRIGGER IF EXISTS tr_auctions_set_updated_at ON public.auctions;
CREATE TRIGGER tr_auctions_set_updated_at
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
