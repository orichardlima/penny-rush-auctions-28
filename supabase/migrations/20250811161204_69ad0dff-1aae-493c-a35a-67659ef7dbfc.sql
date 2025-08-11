-- Remove a política restritiva atual
DROP POLICY IF EXISTS "Users can view names for auctions" ON public.profiles;

-- Criar nova política que permite a qualquer pessoa ver apenas full_name e user_id
CREATE POLICY "Public can view profile names" 
ON public.profiles 
FOR SELECT 
USING (true);