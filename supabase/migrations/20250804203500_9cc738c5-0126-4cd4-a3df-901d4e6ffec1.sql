-- Create table for fake users
CREATE TABLE public.fake_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for fake_users
ALTER TABLE public.fake_users ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage fake users
CREATE POLICY "Admins can manage fake users" 
ON public.fake_users 
FOR ALL 
USING (is_admin_user(auth.uid()));

-- Populate with Brazilian names
INSERT INTO public.fake_users (name) VALUES 
  ('Ana Silva'),
  ('Carlos Santos'),
  ('Maria Oliveira'),
  ('João Pereira'),
  ('Fernanda Costa'),
  ('Ricardo Lima'),
  ('Juliana Almeida'),
  ('Pedro Rodrigues'),
  ('Camila Ferreira'),
  ('Lucas Martins'),
  ('Beatriz Souza'),
  ('Rafael Gonçalves'),
  ('Larissa Barbosa'),
  ('Thiago Ribeiro'),
  ('Gabriela Carvalho'),
  ('Bruno Nascimento'),
  ('Mariana Araújo'),
  ('Felipe Dias'),
  ('Amanda Rocha'),
  ('Gustavo Torres'),
  ('Natália Cardoso'),
  ('Daniel Miranda'),
  ('Isabela Freitas'),
  ('Rodrigo Cunha'),
  ('Priscila Monteiro'),
  ('Vinícius Pinto'),
  ('Tatiane Moura'),
  ('Alexandre Nunes'),
  ('Vanessa Castro'),
  ('Marcos Teixeira');

-- Add automation fields to auctions table
ALTER TABLE public.auctions 
ADD COLUMN auto_bid_enabled BOOLEAN DEFAULT false,
ADD COLUMN min_revenue_target INTEGER DEFAULT 0,
ADD COLUMN auto_bid_min_interval INTEGER DEFAULT 1,
ADD COLUMN auto_bid_max_interval INTEGER DEFAULT 10,
ADD COLUMN last_auto_bid_at TIMESTAMP WITH TIME ZONE;

-- Update bot_logs to include more details for auto bidding
ALTER TABLE public.bot_logs 
ADD COLUMN fake_user_name TEXT,
ADD COLUMN bid_type TEXT DEFAULT 'protection',
ADD COLUMN time_remaining INTEGER;

-- Function to get random fake user
CREATE OR REPLACE FUNCTION public.get_random_fake_user()
RETURNS TABLE(user_id uuid, user_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  bot_user_id uuid;
  fake_name text;
BEGIN
  -- Get bot user ID
  bot_user_id := public.ensure_bot_user();
  
  -- Get random fake user name
  SELECT name INTO fake_name
  FROM public.fake_users
  ORDER BY RANDOM()
  LIMIT 1;
  
  RETURN QUERY SELECT bot_user_id, fake_name;
END;
$function$;