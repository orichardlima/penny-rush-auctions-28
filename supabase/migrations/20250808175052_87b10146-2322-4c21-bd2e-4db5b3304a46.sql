-- Create table to log bot webhook triggers
CREATE TABLE IF NOT EXISTS public.bot_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL,
  triggered_by uuid NULL,
  correlation_id text NULL,
  status text NOT NULL,
  http_status integer NULL,
  response_body text NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bot_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups per auction and recent first
CREATE INDEX IF NOT EXISTS idx_bot_webhook_logs_auction_created_at 
  ON public.bot_webhook_logs (auction_id, created_at DESC);

-- Admins can view all logs
CREATE POLICY IF NOT EXISTS "Admins can view bot webhook logs"
ON public.bot_webhook_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

-- Admins can insert logs (edge function uses service role and bypasses RLS, but keep policy for manual ops)
CREATE POLICY IF NOT EXISTS "Admins can insert bot webhook logs"
ON public.bot_webhook_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

-- Do not allow UPDATE/DELETE by default (no policies created)
