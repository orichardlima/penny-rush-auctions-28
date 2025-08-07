-- Criar trigger para atualizar estatísticas quando um lance é inserido
DROP TRIGGER IF EXISTS update_auction_on_bid ON public.bids;
CREATE TRIGGER update_auction_on_bid
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats();