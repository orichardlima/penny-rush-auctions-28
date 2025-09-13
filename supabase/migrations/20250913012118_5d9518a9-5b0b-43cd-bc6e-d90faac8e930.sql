-- Create email logs table
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- sent, failed, delivered, opened
  error_message TEXT,
  email_provider_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all email logs" 
ON public.email_logs 
FOR SELECT 
USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert email logs" 
ON public.email_logs 
FOR INSERT 
WITH CHECK (is_admin_user(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Modify handle_new_user function to trigger welcome email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  bonus_enabled boolean := false;
  bonus_amount integer := 0;
BEGIN
  -- Get signup bonus settings
  SELECT (setting_value::boolean) INTO bonus_enabled 
  FROM public.system_settings 
  WHERE setting_key = 'signup_bonus_enabled';
  
  SELECT (setting_value::integer) INTO bonus_amount 
  FROM public.system_settings 
  WHERE setting_key = 'signup_bonus_bids';
  
  -- Create user profile
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    email,
    cpf,
    phone,
    birth_date,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    bids_balance,
    signup_bonus_received,
    signup_bonus_amount,
    signup_bonus_date
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'cpf',
    NEW.raw_user_meta_data ->> 'phone',
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data ->> 'cep',
    NEW.raw_user_meta_data ->> 'street',
    NEW.raw_user_meta_data ->> 'number',
    NEW.raw_user_meta_data ->> 'complement',
    NEW.raw_user_meta_data ->> 'neighborhood',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'state',
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0)
      ELSE 0
    END,
    COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0,
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN COALESCE(bonus_amount, 0)
      ELSE 0
    END,
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 
      THEN timezone('America/Sao_Paulo', now())
      ELSE NULL
    END
  );
  
  -- Log signup bonus if granted
  IF COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 THEN
    RAISE LOG 'Signup bonus granted: % bids for user % at %', 
      bonus_amount, NEW.id, timezone('America/Sao_Paulo', now());
  END IF;
  
  -- Send welcome email asynchronously
  PERFORM net.http_post(
    url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
    ),
    body := jsonb_build_object(
      'type', 'welcome',
      'to', NEW.email,
      'data', jsonb_build_object(
        'userName', COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuário'),
        'bonusAmount', CASE 
          WHEN COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0)
          ELSE 0
        END,
        'hasBonus', COALESCE(bonus_enabled, false) AND COALESCE(bonus_amount, 0) > 0
      )
    )
  );
  
  RAISE LOG 'Welcome email triggered for user %', NEW.email;
  
  RETURN NEW;
END;
$function$;

-- Create function to send auction win email
CREATE OR REPLACE FUNCTION public.send_auction_win_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  winner_email text;
  winner_name text;
BEGIN
  -- Only send email when auction changes to finished and has a winner
  IF OLD.status IS DISTINCT FROM 'finished' AND NEW.status = 'finished' AND NEW.winner_id IS NOT NULL THEN
    
    -- Get winner email and name
    SELECT email, full_name INTO winner_email, winner_name
    FROM public.profiles
    WHERE user_id = NEW.winner_id;
    
    IF winner_email IS NOT NULL THEN
      -- Send auction win email asynchronously
      PERFORM net.http_post(
        url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
        ),
        body := jsonb_build_object(
          'type', 'auction_win',
          'to', winner_email,
          'data', jsonb_build_object(
            'userName', COALESCE(winner_name, 'Usuário'),
            'productName', NEW.title,
            'finalPrice', NEW.current_price,
            'marketValue', NEW.market_value,
            'auctionId', NEW.id::text
          )
        )
      );
      
      RAISE LOG 'Auction win email triggered for auction % - winner: %', NEW.id, winner_email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for auction win emails
CREATE TRIGGER send_auction_win_email_trigger
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.send_auction_win_email();

-- Create function to send order status emails
CREATE OR REPLACE FUNCTION public.send_order_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  winner_email text;
  winner_name text;
BEGIN
  -- Only send email when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Get winner email and name
    SELECT email, full_name INTO winner_email, winner_name
    FROM public.profiles
    WHERE user_id = NEW.winner_id;
    
    IF winner_email IS NOT NULL AND NEW.status IN ('paid', 'shipped', 'delivered') THEN
      -- Send order status email asynchronously
      PERFORM net.http_post(
        url := 'https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'
        ),
        body := jsonb_build_object(
          'type', 'order_status',
          'to', winner_email,
          'data', jsonb_build_object(
            'userName', COALESCE(winner_name, 'Usuário'),
            'productName', NEW.product_name,
            'status', NEW.status,
            'trackingCode', NEW.tracking_code,
            'orderId', NEW.id::text
          )
        )
      );
      
      RAISE LOG 'Order status email triggered for order % - status: % - user: %', NEW.id, NEW.status, winner_email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for order status emails
CREATE TRIGGER send_order_status_email_trigger
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.send_order_status_email();