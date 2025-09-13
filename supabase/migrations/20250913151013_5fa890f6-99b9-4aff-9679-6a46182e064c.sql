-- Recriar o trigger para garantir que use a função atualizada
DROP TRIGGER IF EXISTS lock_finished_auctions_trigger ON public.auctions;

CREATE TRIGGER lock_finished_auctions_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.lock_finished_auctions();