-- Enable realtime for bid_purchases table
ALTER TABLE public.bid_purchases REPLICA IDENTITY FULL;

-- Add bid_purchases to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_purchases;