-- MIGRAÇÃO COMPLETA: CENTAVOS → REAIS
-- Converter todas as colunas monetárias de integer (centavos) para numeric (reais)

-- 1. AUCTIONS TABLE
ALTER TABLE public.auctions 
  ALTER COLUMN starting_price TYPE numeric(10,2) USING (starting_price / 100.0),
  ALTER COLUMN current_price TYPE numeric(10,2) USING (current_price / 100.0),
  ALTER COLUMN bid_increment TYPE numeric(10,2) USING (bid_increment / 100.0),
  ALTER COLUMN bid_cost TYPE numeric(10,2) USING (bid_cost / 100.0),
  ALTER COLUMN revenue_target TYPE numeric(10,2) USING (revenue_target / 100.0),
  ALTER COLUMN market_value TYPE numeric(10,2) USING (market_value / 100.0);

-- Atualizar defaults
ALTER TABLE public.auctions 
  ALTER COLUMN starting_price SET DEFAULT 1.00,
  ALTER COLUMN current_price SET DEFAULT 1.00,
  ALTER COLUMN bid_increment SET DEFAULT 0.01,
  ALTER COLUMN bid_cost SET DEFAULT 1.00,
  ALTER COLUMN revenue_target SET DEFAULT 0.00,
  ALTER COLUMN market_value SET DEFAULT 0.00;

-- 2. BIDS TABLE
ALTER TABLE public.bids 
  ALTER COLUMN bid_amount TYPE numeric(10,2) USING (bid_amount / 100.0),
  ALTER COLUMN cost_paid TYPE numeric(10,2) USING (cost_paid / 100.0);

-- 3. BID_PACKAGES TABLE
ALTER TABLE public.bid_packages 
  ALTER COLUMN price TYPE numeric(10,2) USING (price / 100.0),
  ALTER COLUMN original_price TYPE numeric(10,2) USING (original_price / 100.0);

-- 4. BID_PURCHASES TABLE
ALTER TABLE public.bid_purchases 
  ALTER COLUMN amount_paid TYPE numeric(10,2) USING (amount_paid / 100.0);

-- 5. PROFILES TABLE
ALTER TABLE public.profiles 
  ALTER COLUMN bids_balance TYPE numeric(10,2) USING (bids_balance / 100.0);

-- Atualizar defaults
ALTER TABLE public.profiles 
  ALTER COLUMN bids_balance SET DEFAULT 0.00;