
-- ==============================================
-- Etapa 1a: Nova coluna last_bidders
-- ==============================================
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS last_bidders jsonb DEFAULT '[]'::jsonb;

-- ==============================================
-- Etapa 1b: Recriar trigger update_auction_on_bid()
-- Agora inclui lógica para popular last_bidders
-- ==============================================
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
  v_full_name text;
  v_display_name text;
  v_name_parts text[];
  v_current_bidders jsonb;
BEGIN
  -- Identificar se é bot (interno) e buscar nome
  SELECT COALESCE(p.is_bot, false), p.full_name 
  INTO is_bot_user, v_full_name
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;

  -- Formatar nome para exibição: "PrimeiroNome S."
  IF v_full_name IS NOT NULL AND v_full_name != '' THEN
    v_name_parts := string_to_array(trim(v_full_name), ' ');
    IF array_length(v_name_parts, 1) >= 2 THEN
      v_display_name := v_name_parts[1] || ' ' || left(v_name_parts[2], 1) || '.';
    ELSIF array_length(v_name_parts, 1) = 1 THEN
      v_display_name := v_name_parts[1];
    ELSE
      v_display_name := 'Usuário';
    END IF;
  ELSE
    v_display_name := 'Usuário';
  END IF;

  -- Buscar last_bidders atual do leilão
  SELECT COALESCE(a.last_bidders, '[]'::jsonb) INTO v_current_bidders
  FROM public.auctions a
  WHERE a.id = NEW.auction_id;

  -- Prepend novo nome e manter máximo 3
  v_current_bidders := (jsonb_build_array(v_display_name) || v_current_bidders);
  -- Truncar para 3 elementos
  IF jsonb_array_length(v_current_bidders) > 3 THEN
    v_current_bidders := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord
        LIMIT 3
      ) sub
    );
  END IF;

  -- Verificar se é bot N8N ou bot interno
  IF is_bot_user OR NEW.cost_paid = 0 THEN
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      last_bid_at = now(),
      last_bidders = v_current_bidders,
      updated_at = now()
    WHERE id = NEW.auction_id;
    
    IF is_bot_user THEN
      RAISE LOG '🤖 [BID-BOT-INTERNO] Bot interno no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    ELSE
      RAISE LOG '🤖 [BID-BOT-N8N] Bot N8N no leilão %: preço atualizado, timer resetado, SEM receita', NEW.auction_id;
    END IF;
    
  ELSE
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + NEW.cost_paid,
      time_left = 15,
      last_bid_at = now(),
      last_bidders = v_current_bidders,
      updated_at = now()
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Usuário real no leilão %: receita +R$%.2f, preço e timer atualizados', NEW.auction_id, NEW.cost_paid;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ==============================================
-- Etapa 1c: Backfill dos leilões ativos/waiting
-- ==============================================
UPDATE public.auctions a
SET last_bidders = COALESCE(
  (
    SELECT jsonb_agg(display_name)
    FROM (
      SELECT 
        CASE
          WHEN p.full_name IS NOT NULL AND p.full_name != '' THEN
            CASE
              WHEN array_length(string_to_array(trim(p.full_name), ' '), 1) >= 2 THEN
                (string_to_array(trim(p.full_name), ' '))[1] || ' ' || left((string_to_array(trim(p.full_name), ' '))[2], 1) || '.'
              ELSE
                (string_to_array(trim(p.full_name), ' '))[1]
            END
          ELSE 'Usuário'
        END as display_name
      FROM public.bids b
      JOIN public.profiles p ON b.user_id = p.user_id
      WHERE b.auction_id = a.id
      ORDER BY b.created_at DESC
      LIMIT 3
    ) sub
  ),
  '[]'::jsonb
)
WHERE a.status IN ('active', 'waiting');
