
CREATE OR REPLACE FUNCTION public.decrement_auction_timers()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  affected_count integer := 0;
  v_bot_user_id uuid;
  v_bot_name text;
  v_bot_city text;
  v_bot_state text;
  v_winner_name text;
  v_auction RECORD;
BEGIN
  -- Decrementar timer de todos os leilões ativos
  UPDATE public.auctions 
  SET 
    time_left = GREATEST(time_left - 1, 0),
    updated_at = timezone('America/Sao_Paulo', now())
  WHERE status = 'active' 
    AND time_left > 0;
    
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE LOG '⏰ [TIMER-TICK] Decrementado timer de % leilões ativos', affected_count;
  END IF;
  
  -- Finalizar leilões com timer zerado - SEMPRE com bot como vencedor
  FOR v_auction IN
    SELECT id, title FROM public.auctions
    WHERE status = 'active' AND time_left <= 0
  LOOP
    -- Buscar bot aleatório
    SELECT user_id, full_name, city, state 
    INTO v_bot_user_id, v_bot_name, v_bot_city, v_bot_state
    FROM public.profiles 
    WHERE is_bot = true 
    ORDER BY random() 
    LIMIT 1;
    
    -- Fallback
    IF v_bot_user_id IS NULL THEN
      v_bot_user_id := 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6'::uuid;
      v_bot_name := 'Sistema';
    END IF;
    
    -- Formatar nome
    IF v_bot_city IS NOT NULL AND v_bot_state IS NOT NULL THEN
      v_winner_name := v_bot_name || ' - ' || v_bot_city || ', ' || v_bot_state;
    ELSE
      v_winner_name := COALESCE(v_bot_name, 'Bot');
    END IF;
    
    UPDATE public.auctions
    SET 
      status = 'finished',
      finished_at = timezone('America/Sao_Paulo', now()),
      winner_id = v_bot_user_id,
      winner_name = v_winner_name
    WHERE id = v_auction.id;
    
    RAISE LOG '🏁 [TIMER-FINISH] Leilão "%" finalizado com bot "%" como vencedor', v_auction.title, v_winner_name;
  END LOOP;
END;
$function$;
