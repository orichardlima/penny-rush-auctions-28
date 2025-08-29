-- Recriar trigger de webhook para leilões ativados
-- Usar a função auction_webhook_unique que tem melhor controle de duplicatas

CREATE TRIGGER auction_activation_webhook_trigger
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.auction_webhook_unique();

-- Log para confirmar que o trigger foi criado
DO $$
BEGIN
  RAISE LOG 'Trigger de webhook recriado: auction_activation_webhook_trigger -> auction_webhook_unique()';
END $$;