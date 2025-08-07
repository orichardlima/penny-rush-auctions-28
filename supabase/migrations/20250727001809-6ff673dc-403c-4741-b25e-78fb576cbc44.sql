-- Create profiles table for users
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  bids_balance INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create auctions table
CREATE TABLE public.auctions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  starting_price INTEGER DEFAULT 100, -- in cents
  current_price INTEGER DEFAULT 100, -- in cents
  bid_increment INTEGER DEFAULT 1, -- in cents
  bid_cost INTEGER DEFAULT 100, -- cost per bid in cents (R$ 1.00)
  time_left INTEGER DEFAULT 15, -- seconds
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished', 'scheduled')),
  winner_id UUID REFERENCES auth.users(id),
  total_bids INTEGER DEFAULT 0,
  participants_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on auctions
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

-- Create policies for auctions
CREATE POLICY "Anyone can view auctions" 
ON public.auctions 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage auctions" 
ON public.auctions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create bids table
CREATE TABLE public.bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_amount INTEGER NOT NULL, -- in cents
  cost_paid INTEGER NOT NULL, -- cost of the bid in cents
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bids
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- Create policies for bids
CREATE POLICY "Users can view their own bids" 
ON public.bids 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bids" 
ON public.bids 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all bids" 
ON public.bids 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create bid_packages table
CREATE TABLE public.bid_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  bids_count INTEGER NOT NULL,
  price INTEGER NOT NULL, -- in cents
  original_price INTEGER, -- in cents (for discounts)
  is_popular BOOLEAN DEFAULT FALSE,
  features TEXT[],
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bid_packages
ALTER TABLE public.bid_packages ENABLE ROW LEVEL SECURITY;

-- Create policies for bid_packages
CREATE POLICY "Anyone can view bid packages" 
ON public.bid_packages 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage bid packages" 
ON public.bid_packages 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create bid_purchases table
CREATE TABLE public.bid_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.bid_packages(id),
  bids_purchased INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL, -- in cents
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bid_purchases
ALTER TABLE public.bid_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies for bid_purchases
CREATE POLICY "Users can view their own purchases" 
ON public.bid_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases" 
ON public.bid_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchases" 
ON public.bid_purchases 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auctions_updated_at
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bid_packages_updated_at
  BEFORE UPDATE ON public.bid_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample bid packages
INSERT INTO public.bid_packages (name, bids_count, price, original_price, is_popular, features, icon) VALUES
('Pacote Iniciante', 50, 4500, 5000, false, ARRAY['50 lances', 'Suporte básico', 'Válido por 30 dias'], 'Zap'),
('Pacote Popular', 150, 12500, 15000, true, ARRAY['150 lances', 'Suporte prioritário', 'Válido por 60 dias', 'Bônus de 10 lances'], 'Crown'),
('Pacote Premium', 300, 22500, 30000, false, ARRAY['300 lances', 'Suporte VIP', 'Válido por 90 dias', 'Bônus de 50 lances', 'Acesso antecipado'], 'Star'),
('Pacote Mega', 500, 35000, 50000, false, ARRAY['500 lances', 'Suporte dedicado', 'Válido por 120 dias', 'Bônus de 100 lances', 'Acesso antecipado', 'Cashback de 5%'], 'Diamond');

-- Insert sample auctions
INSERT INTO public.auctions (title, description, image_url, starting_price, current_price, status) VALUES
('iPhone 15 Pro Max 256GB', 'iPhone 15 Pro Max com 256GB de armazenamento, cor Titânio Natural', '/src/assets/iphone-15-pro.jpg', 100, 156, 'active'),
('MacBook Air M2 13"', 'MacBook Air com chip M2, 13 polegadas, 8GB RAM, 256GB SSD', '/src/assets/macbook-air-m2.jpg', 100, 234, 'active'),
('Samsung Galaxy S24 Ultra', 'Samsung Galaxy S24 Ultra 512GB, cor Preto Titânio', '/src/assets/samsung-s24.jpg', 100, 189, 'active'),
('PlayStation 5', 'Console PlayStation 5 com controle DualSense', '/src/assets/playstation-5.jpg', 100, 167, 'active'),
('Smart TV 55" 4K', 'Smart TV LED 55 polegadas 4K Ultra HD com Android TV', '/src/assets/smart-tv-55.jpg', 100, 123, 'active'),
('Apple Watch Ultra', 'Apple Watch Ultra com pulseira Alpine Loop', '/src/assets/apple-watch-ultra.jpg', 100, 98, 'active');