-- Criar trigger para atualizar estatísticas do leilão quando um lance é inserido
CREATE OR REPLACE TRIGGER trigger_update_auction_stats
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats();