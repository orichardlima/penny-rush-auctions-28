-- Create orders table for managing auction wins and deliveries
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL,
  winner_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  final_price NUMERIC NOT NULL DEFAULT 0.00,
  market_value NUMERIC NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_method TEXT,
  payment_proof_url TEXT,
  delivery_address JSONB,
  tracking_code TEXT,
  estimated_delivery DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for orders
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = winner_id);

CREATE POLICY "Users can update their own orders payment info"
ON public.orders
FOR UPDATE
USING (auth.uid() = winner_id AND status = 'awaiting_payment');

CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
USING (is_admin_user(auth.uid()));

-- Create trigger for automatic order creation when auction finishes
CREATE OR REPLACE FUNCTION public.create_order_on_auction_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only create order if auction just changed to finished and has a winner
  IF OLD.status IS DISTINCT FROM 'finished' AND NEW.status = 'finished' AND NEW.winner_id IS NOT NULL THEN
    INSERT INTO public.orders (
      auction_id,
      winner_id,
      product_name,
      final_price,
      market_value,
      status
    ) VALUES (
      NEW.id,
      NEW.winner_id,
      NEW.title,
      NEW.current_price,
      NEW.market_value,
      'awaiting_payment'
    );
    
    RAISE LOG 'Order created for auction % - winner: %', NEW.id, NEW.winner_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER create_order_on_finish
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_order_on_auction_finish();

-- Add updated_at trigger for orders
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user orders
CREATE OR REPLACE FUNCTION public.get_user_orders(user_uuid uuid)
RETURNS TABLE(
  id uuid,
  auction_id uuid,
  product_name text,
  final_price numeric,
  market_value numeric,
  savings numeric,
  status text,
  payment_method text,
  tracking_code text,
  estimated_delivery date,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.auction_id,
    o.product_name,
    o.final_price,
    o.market_value,
    (o.market_value - o.final_price) as savings,
    o.status,
    o.payment_method,
    o.tracking_code,
    o.estimated_delivery,
    o.created_at,
    o.updated_at
  FROM public.orders o
  WHERE o.winner_id = user_uuid
  ORDER BY o.created_at DESC;
END;
$function$;