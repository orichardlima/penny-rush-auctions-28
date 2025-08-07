-- Enable required extensions for the auto-bid system
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Fix expired auctions - mark them as finished
UPDATE public.auctions 
SET status = 'finished', updated_at = now()
WHERE status = 'active' 
  AND ends_at IS NOT NULL 
  AND ends_at < NOW();

-- Enable auto-bid for active auctions and set minimum revenue targets
UPDATE public.auctions 
SET 
  auto_bid_enabled = true,
  min_revenue_target = CASE 
    WHEN market_value > 0 THEN market_value * 0.3  -- 30% of market value
    ELSE 1000  -- Default minimum target of R$ 10.00
  END,
  auto_bid_min_interval = 2,  -- Minimum 2 seconds between bids
  auto_bid_max_interval = 8,  -- Maximum 8 seconds between bids
  updated_at = now()
WHERE status = 'active';