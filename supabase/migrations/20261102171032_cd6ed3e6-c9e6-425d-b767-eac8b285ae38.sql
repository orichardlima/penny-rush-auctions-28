DROP POLICY IF EXISTS "Administradores podem atualizar imagens dos leilões" ON storage.objects;
DROP POLICY IF EXISTS "Administradores podem deletar imagens dos leilões" ON storage.objects;
DROP POLICY IF EXISTS "Administradores podem fazer upload de imagens dos leilões" ON storage.objects;
CREATE POLICY "Administradores podem atualizar imagens dos leilões" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'auction-images' AND public.is_admin_user(auth.uid()))
  WITH CHECK (bucket_id = 'auction-images' AND public.is_admin_user(auth.uid()));
CREATE POLICY "Administradores podem deletar imagens dos leilões" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'auction-images' AND public.is_admin_user(auth.uid()));
CREATE POLICY "Administradores podem fazer upload de imagens dos leilões" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auction-images' AND public.is_admin_user(auth.uid()));