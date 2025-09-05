-- FASE 1: Cleanup and Fix Stuck Auction
-- Fix the stuck auction that's been active for over 1 hour
UPDATE public.auctions 
SET 
  status = 'finished',
  finished_at = timezone('America/Sao_Paulo', now()),
  winner_id = (
    SELECT user_id 
    FROM public.bids 
    WHERE auction_id = 'b18e86cb-a55c-4741-8613-2dae6d2478bc'::uuid
    ORDER BY created_at DESC 
    LIMIT 1
  ),
  winner_name = (
    SELECT p.full_name 
    FROM public.bids b
    JOIN public.profiles p ON b.user_id = p.user_id
    WHERE b.auction_id = 'b18e86cb-a55c-4741-8613-2dae6d2478bc'::uuid
    ORDER BY b.created_at DESC 
    LIMIT 1
  )
WHERE id = 'b18e86cb-a55c-4741-8613-2dae6d2478bc'::uuid;

-- FASE 2: Create Independent Timer System
-- Create auction_timers table for independent timer control
CREATE TABLE IF NOT EXISTS public.auction_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL UNIQUE,
  timer_started_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  last_bid_at timestamp with time zone,
  seconds_remaining integer NOT NULL DEFAULT 15,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Enable RLS on auction_timers
ALTER TABLE public.auction_timers ENABLE ROW LEVEL SECURITY;

-- RLS policies for auction_timers
CREATE POLICY "Anyone can view auction timers" 
ON public.auction_timers 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage auction timers" 
ON public.auction_timers 
FOR ALL 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_auction_timers_updated_at
BEFORE UPDATE ON public.auction_timers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- FASE 3: Update Bid Function to Handle Bot vs User Bids Correctly
CREATE OR REPLACE FUNCTION public.update_auction_on_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  is_bot_user boolean := false;
  current_time_br timestamp with time zone;
BEGIN
  current_time_br := timezone('America/Sao_Paulo', now());
  
  SELECT COALESCE(p.is_bot, false) INTO is_bot_user
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id;
  
  IF is_bot_user THEN
    -- Bot bid: update price, bids and RESET TIMER but NO company_revenue increment
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🤖 [BID-BOT] Lance bot no leilão %: timer resetado, SEM incremento de receita', NEW.auction_id;
  ELSE
    -- User bid: update everything INCLUDING revenue and RESET TIMER
    UPDATE public.auctions
    SET 
      total_bids = total_bids + 1,
      current_price = current_price + bid_increment,
      company_revenue = company_revenue + bid_cost,
      time_left = 15,
      updated_at = current_time_br
    WHERE id = NEW.auction_id;
    
    RAISE LOG '🙋 [BID-USER] Lance usuário no leilão %: receita +R$%.2f, timer resetado', 
      NEW.auction_id, NEW.cost_paid;
  END IF;
  
  -- Update or create timer record
  INSERT INTO public.auction_timers (auction_id, last_bid_at, seconds_remaining)
  VALUES (NEW.auction_id, current_time_br, 15)
  ON CONFLICT (auction_id) 
  DO UPDATE SET 
    last_bid_at = current_time_br,
    seconds_remaining = 15,
    updated_at = current_time_br;
  
  RETURN NEW;
END;
$function$;

-- Create function to initialize timer when auction becomes active
CREATE OR REPLACE FUNCTION public.initialize_auction_timer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only initialize timer when status changes to 'active'
  IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
    INSERT INTO public.auction_timers (auction_id, seconds_remaining)
    VALUES (NEW.id, 15)
    ON CONFLICT (auction_id) 
    DO UPDATE SET 
      timer_started_at = timezone('America/Sao_Paulo', now()),
      seconds_remaining = 15,
      updated_at = timezone('America/Sao_Paulo', now());
      
    RAISE LOG '⏰ [TIMER-INIT] Timer iniciado para leilão %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to initialize timer on auction activation
DROP TRIGGER IF EXISTS initialize_auction_timer_trigger ON public.auctions;
CREATE TRIGGER initialize_auction_timer_trigger
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.initialize_auction_timer();

-- Initialize timers for currently active auctions
INSERT INTO public.auction_timers (auction_id, seconds_remaining)
SELECT id, GREATEST(time_left, 0)
FROM public.auctions 
WHERE status = 'active'
ON CONFLICT (auction_id) DO NOTHING;

-- Log completion
DO $$
BEGIN
  RAISE LOG '✅ [SETUP] Sistema de timers independentes implementado - Fase 1 e 2 completas';
END $$;