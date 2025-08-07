-- Adicionar campos de proteção na tabela auctions
ALTER TABLE public.auctions 
ADD COLUMN protected_mode boolean DEFAULT false,
ADD COLUMN protected_target integer DEFAULT 0;

-- Adicionar campo is_bot na tabela bids
ALTER TABLE public.bids 
ADD COLUMN is_bot boolean DEFAULT false;

-- Criar tabela para logs de bots
CREATE TABLE public.bot_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bid_amount integer NOT NULL,
  target_revenue integer NOT NULL,
  current_revenue integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela bot_logs
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- Política para admins verem logs de bots
CREATE POLICY "Admins can view bot logs" 
ON public.bot_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.is_admin = true
));

-- Criar função para calcular faturamento atual de um leilão
CREATE OR REPLACE FUNCTION public.get_auction_revenue(auction_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_revenue integer := 0;
BEGIN
  SELECT COALESCE(SUM(cost_paid), 0)
  INTO total_revenue
  FROM public.bids
  WHERE auction_id = auction_uuid;
  
  RETURN total_revenue;
END;
$$;

-- Criar usuário bot se não existir (através de uma função)
CREATE OR REPLACE FUNCTION public.ensure_bot_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bot_user_id uuid;
BEGIN
  -- Buscar ou criar perfil do bot
  SELECT user_id INTO bot_user_id
  FROM public.profiles
  WHERE email = 'bot@sistema.local'
  LIMIT 1;
  
  IF bot_user_id IS NULL THEN
    -- Criar um UUID fixo para o bot
    bot_user_id := gen_random_uuid();
    
    INSERT INTO public.profiles (
      user_id, 
      full_name, 
      email, 
      bids_balance,
      is_admin
    ) VALUES (
      bot_user_id,
      'Sistema Bot',
      'bot@sistema.local',
      999999999,  -- Saldo infinito para o bot
      false
    );
  END IF;
  
  RETURN bot_user_id;
END;
$$;

-- Trigger para atualizar estatísticas do leilão quando um bid é inserido
CREATE OR REPLACE FUNCTION public.update_auction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualizar total de bids e resetar timer
  UPDATE public.auctions
  SET 
    total_bids = total_bids + 1,
    current_price = current_price + bid_increment,
    time_left = 15,  -- Reset timer para 15 segundos
    updated_at = now()
  WHERE id = NEW.auction_id;
  
  -- Se o leilão atingiu a meta de proteção, desativar proteção
  UPDATE public.auctions
  SET protected_mode = false
  WHERE id = NEW.auction_id 
    AND protected_mode = true
    AND protected_target > 0
    AND (
      SELECT COALESCE(SUM(cost_paid), 0)
      FROM public.bids
      WHERE auction_id = NEW.auction_id
    ) >= protected_target;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para atualizar stats após inserção de bid
DROP TRIGGER IF EXISTS update_auction_stats_trigger ON public.bids;
CREATE TRIGGER update_auction_stats_trigger
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_auction_stats();

-- Habilitar realtime para a tabela bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;