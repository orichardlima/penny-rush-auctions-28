-- Fix the status constraint to allow 'waiting' status
ALTER TABLE public.auctions 
DROP CONSTRAINT auctions_status_check;

-- Add the updated constraint with 'waiting' included
ALTER TABLE public.auctions 
ADD CONSTRAINT auctions_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'finished'::text, 'scheduled'::text, 'waiting'::text]));