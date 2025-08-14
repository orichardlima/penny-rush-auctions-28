-- Fase 1: Corrigir função SQL get_auction_financials para retornar valores corretos
DROP FUNCTION IF EXISTS public.get_auction_financials(uuid);

CREATE OR REPLACE FUNCTION public.get_auction_financials(auction_uuid uuid)
 RETURNS TABLE(auction_id uuid, title text, total_bids_count integer, user_bids_count integer, bot_bids_count integer, user_bids_percentage numeric, bot_bids_percentage numeric, real_revenue numeric, revenue_target numeric, target_percentage numeric, current_price numeric, market_value numeric, roi_percentage numeric, profit_margin numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as auction_id,
    a.title,
    a.total_bids as total_bids_count,
    COALESCE(user_stats.user_bids, 0)::integer as user_bids_count,
    COALESCE(bot_stats.bot_bids, 0)::integer as bot_bids_count,
    CASE 
      WHEN a.total_bids > 0 THEN ROUND((COALESCE(user_stats.user_bids, 0)::decimal / a.total_bids::decimal) * 100, 2)
      ELSE 0::decimal
    END as user_bids_percentage,
    CASE 
      WHEN a.total_bids > 0 THEN ROUND((COALESCE(bot_stats.bot_bids, 0)::decimal / a.total_bids::decimal) * 100, 2)
      ELSE 0::decimal
    END as bot_bids_percentage,
    a.company_revenue as real_revenue, -- Já está em reais, não dividir por 100
    a.revenue_target, -- Já está em reais
    CASE 
      WHEN a.revenue_target > 0 THEN ROUND((a.company_revenue / a.revenue_target::decimal) * 100, 2)
      ELSE 0::decimal
    END as target_percentage,
    a.current_price, -- Já está em reais
    a.market_value, -- Já está em reais
    CASE 
      WHEN a.market_value > 0 THEN ROUND((a.company_revenue / a.market_value::decimal) * 100, 2)
      ELSE 0::decimal
    END as roi_percentage,
    (a.company_revenue - a.market_value::decimal) as profit_margin,
    a.status
  FROM public.auctions a
  LEFT JOIN (
    SELECT 
      b.auction_id,
      COUNT(*) as user_bids,
      SUM(b.cost_paid) as user_revenue
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE COALESCE(p.is_bot, false) = false
    GROUP BY b.auction_id
  ) user_stats ON a.id = user_stats.auction_id
  LEFT JOIN (
    SELECT 
      b.auction_id,
      COUNT(*) as bot_bids
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE p.is_bot = true
    GROUP BY b.auction_id
  ) bot_stats ON a.id = bot_stats.auction_id
  WHERE a.id = auction_uuid;
END;
$function$;

-- Fase 4: Corrigir status default da tabela auctions de 'active' para 'waiting'
ALTER TABLE public.auctions ALTER COLUMN status SET DEFAULT 'waiting';

-- Atualizar leilões ativos que não deveriam estar ativos ainda
UPDATE public.auctions 
SET status = 'waiting' 
WHERE status = 'active' 
  AND starts_at > NOW() 
  AND total_bids = 0;

-- Adicionar trigger para log de mudanças de status
CREATE OR REPLACE FUNCTION public.log_auction_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE LOG 'Auction % status changed from "%" to "%" at %', 
      NEW.id, COALESCE(OLD.status, 'NULL'), NEW.status, NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS log_auction_status_changes ON public.auctions;
CREATE TRIGGER log_auction_status_changes
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_auction_status_change();