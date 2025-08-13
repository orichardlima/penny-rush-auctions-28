-- Criar job automático para encerrar leilões expirados a cada 5 segundos
SELECT cron.schedule(
  'finalize-expired-auctions',
  '*/5 * * * * *', -- A cada 5 segundos
  $$
  SELECT public.finalize_expired_auctions();
  $$
);

-- Garantir que o trigger de finalização está ativo
DROP TRIGGER IF EXISTS finalize_auction_trigger ON public.auctions;
CREATE TRIGGER finalize_auction_trigger
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.finalize_auction_on_timer_zero();