-- Habilitar realtime para a tabela auctions
ALTER TABLE public.auctions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;