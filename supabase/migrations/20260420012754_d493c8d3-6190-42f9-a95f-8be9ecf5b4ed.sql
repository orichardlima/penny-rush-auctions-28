-- 1. Adicionar colunas em product_templates
ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS image_key text,
  ADD COLUMN IF NOT EXISTS image_source text NOT NULL DEFAULT 'ai';

-- 2. Adicionar coluna image_key em auctions
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS image_key text;

-- 3. Criar bucket de storage product-images (público para leitura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS policies do bucket product-images
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can insert product images" ON storage.objects;
CREATE POLICY "Admins can insert product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND public.is_admin_user(auth.uid()));