-- Criar trigger para atualizar estatísticas do leilão quando um lance é feito
CREATE TRIGGER update_auction_stats_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats();