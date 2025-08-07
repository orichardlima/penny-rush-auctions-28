-- Criar bucket para imagens dos leilões
INSERT INTO storage.buckets (id, name, public) 
VALUES ('auction-images', 'auction-images', true);

-- Políticas para o bucket de imagens
CREATE POLICY "Anyone can view auction images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'auction-images');

CREATE POLICY "Admins can upload auction images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'auction-images' 
  AND public.is_admin_user(auth.uid())
);

CREATE POLICY "Admins can update auction images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'auction-images' 
  AND public.is_admin_user(auth.uid())
);

CREATE POLICY "Admins can delete auction images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'auction-images' 
  AND public.is_admin_user(auth.uid())
);