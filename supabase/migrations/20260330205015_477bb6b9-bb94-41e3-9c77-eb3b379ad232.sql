
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Create function to release pending referral bonuses
CREATE OR REPLACE FUNCTION public.release_pending_referral_bonuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer;
BEGIN
  UPDATE partner_referral_bonuses
  SET status = 'AVAILABLE'
  WHERE status = 'PENDING'
    AND available_at IS NOT NULL
    AND available_at <= now();
  
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;
