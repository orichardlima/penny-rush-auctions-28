-- Criar políticas para acesso público às imagens dos leilões
CREATE POLICY "Imagens dos leilões são publicamente acessíveis" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'auction-images');

-- Política para permitir uploads de imagens pelos administradores
CREATE POLICY "Administradores podem fazer upload de imagens dos leilões" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'auction-images' 
  AND auth.uid() IS NOT NULL
);

-- Política para permitir atualizações pelos administradores
CREATE POLICY "Administradores podem atualizar imagens dos leilões" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'auction-images' 
  AND auth.uid() IS NOT NULL
);

-- Política para permitir exclusão pelos administradores
CREATE POLICY "Administradores podem deletar imagens dos leilões" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'auction-images' 
  AND auth.uid() IS NOT NULL
);