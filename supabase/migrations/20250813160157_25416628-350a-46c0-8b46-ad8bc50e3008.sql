-- CORRIGIR ERRO DE AMBIGUIDADE NA FUNÇÃO
CREATE OR REPLACE FUNCTION public.finalize_expired_auctions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  auction_record RECORD;
  winner_user_id UUID;
  winner_display_name TEXT;
  utc_now TIMESTAMPTZ;
  expired_count INTEGER := 0;
BEGIN
  utc_now := NOW();
  
  RAISE LOG '🔍 [FINALIZE] Verificando leilões expirados às %', utc_now;
  
  -- Buscar leilões ativos que expiraram (15+ segundos sem lance)
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
    
    RAISE LOG '🏁 [FINALIZE] Encerrando leilão % ("%") - % segundos inativo', 
      auction_record.id, auction_record.title, auction_record.seconds_inactive;
    
    -- Buscar último lance para determinar ganhador
    SELECT b.user_id, p.full_name
    INTO winner_user_id, winner_display_name
    FROM public.bids b
    LEFT JOIN public.profiles p ON b.user_id = p.user_id
    WHERE b.auction_id = auction_record.id
    ORDER BY b.created_at DESC
    LIMIT 1;
    
    -- Definir nome do ganhador
    IF winner_display_name IS NOT NULL AND trim(winner_display_name) != '' THEN
      -- Usar nome completo
      winner_display_name := winner_display_name;
    ELSIF winner_user_id IS NOT NULL THEN
      -- Fallback para ID parcial
      winner_display_name := 'Usuário ' || SUBSTRING(winner_user_id::text FROM 1 FOR 8);
    ELSE
      -- Sem ganhador
      winner_display_name := 'Nenhum ganhador';
      winner_user_id := NULL;
    END IF;
    
    -- ENCERRAR LEILÃO DEFINITIVAMENTE
    UPDATE public.auctions
    SET 
      status = 'finished',
      time_left = 0,
      winner_id = winner_user_id,
      winner_name = winner_display_name,
      finished_at = utc_now,
      updated_at = utc_now
    WHERE id = auction_record.id;
    
    expired_count := expired_count + 1;
    
    RAISE LOG '✅ [FINALIZE] Leilão % encerrado com sucesso! Ganhador: "%"', 
      auction_record.id, winner_display_name;
      
  END LOOP;
  
  RAISE LOG '🔚 [FINALIZE] Verificação concluída. % leilões encerrados às %', expired_count, utc_now;
END;
$$;

-- TESTAR A FUNÇÃO MANUALMENTE
SELECT public.finalize_expired_auctions();