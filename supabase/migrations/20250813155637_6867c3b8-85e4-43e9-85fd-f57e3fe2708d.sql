-- DELETAR TODAS AS FUNÇÕES E CRON JOBS RELACIONADOS AO ENCERRAMENTO
DROP FUNCTION IF EXISTS public.auto_finalize_inactive_auctions() CASCADE;
DROP FUNCTION IF EXISTS public.finalize_expired_auctions() CASCADE;

-- Deletar cron jobs existentes relacionados
SELECT cron.unschedule('finalize-expired-auctions-job');

-- CRIAR FUNÇÃO SIMPLES E ROBUSTA PARA ENCERRAR LEILÕES
CREATE OR REPLACE FUNCTION public.check_and_finalize_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auction_record RECORD;
  winner_user_id UUID;
  winner_name TEXT;
  utc_now TIMESTAMPTZ;
BEGIN
  utc_now := NOW();
  
  RAISE LOG '🔍 [AUCTION-CHECK] Verificando leilões ativos às %', utc_now;
  
  -- Buscar leilões ativos que precisam ser encerrados (15+ segundos sem lance)
  FOR auction_record IN 
    SELECT 
      a.id, 
      a.title, 
      a.updated_at,
      EXTRACT(EPOCH FROM (utc_now - a.updated_at))::integer as seconds_inactive
    FROM public.auctions a
    WHERE a.status = 'active'
    AND EXTRACT(EPOCH FROM (utc_now - a.updated_at)) >= 15
  LOOP
    
    RAISE LOG '🏁 [AUCTION-FINALIZE] Encerrando leilão % - % segundos inativo', 
      auction_record.id, auction_record.seconds_inactive;
    
    -- Buscar último lance para determinar ganhador
    SELECT b.user_id, p.full_name
    INTO winner_user_id, winner_name
    FROM public.bids b
    LEFT JOIN public.profiles p ON b.user_id = p.user_id
    WHERE b.auction_id = auction_record.id
    ORDER BY b.created_at DESC
    LIMIT 1;
    
    -- Definir nome do ganhador
    IF winner_name IS NOT NULL AND trim(winner_name) != '' THEN
      winner_name := winner_name;
    ELSIF winner_user_id IS NOT NULL THEN
      winner_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
    ELSE
      winner_name := 'Nenhum ganhador';
      winner_user_id := NULL;
    END IF;
    
    -- ENCERRAR LEILÃO
    UPDATE public.auctions
    SET 
      status = 'finished',
      time_left = 0,
      winner_id = winner_user_id,
      winner_name = winner_name,
      finished_at = utc_now,
      updated_at = utc_now
    WHERE id = auction_record.id;
    
    RAISE LOG '✅ [AUCTION-FINALIZE] Leilão % encerrado! Ganhador: %', 
      auction_record.id, winner_name;
      
  END LOOP;
  
  RAISE LOG '🔚 [AUCTION-CHECK] Verificação concluída às %', utc_now;
END;
$$;

-- AGENDAR VERIFICAÇÃO A CADA 5 SEGUNDOS
SELECT cron.schedule(
  'auction-finalizer',
  '*/5 * * * * *',
  'SELECT public.check_and_finalize_auctions();'
);