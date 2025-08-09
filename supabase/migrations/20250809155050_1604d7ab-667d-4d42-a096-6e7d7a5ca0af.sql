-- Limpar triggers duplicados na tabela bids que estão causando contabilização dupla de lances

-- 1) Remover todos os triggers duplicados relacionados a atualização de estatísticas
DROP TRIGGER IF EXISTS update_auction_stats_trigger ON public.bids;
DROP TRIGGER IF EXISTS trigger_update_auction_stats ON public.bids;
DROP TRIGGER IF EXISTS update_auction_on_bid ON public.bids;
DROP TRIGGER IF EXISTS tr_bids_after_insert_update_stats ON public.bids;

-- 2) Remover triggers duplicados de prevenção de lances
DROP TRIGGER IF EXISTS trg_prevent_bids_on_inactive ON public.bids;
DROP TRIGGER IF EXISTS tr_bids_before_insert_prevent ON public.bids;

-- 3) Criar apenas UM trigger para prevenção de lances inválidos (BEFORE INSERT)
CREATE TRIGGER tr_prevent_invalid_bids
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_bids_on_inactive_auctions();

-- 4) Criar apenas UM trigger para atualizar estatísticas (AFTER INSERT)
CREATE TRIGGER tr_update_auction_stats_on_bid
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.update_auction_stats();

-- 5) Log de confirmação
DO $$
BEGIN
    RAISE LOG 'Triggers consolidados na tabela bids - duplicações removidas';
END $$;