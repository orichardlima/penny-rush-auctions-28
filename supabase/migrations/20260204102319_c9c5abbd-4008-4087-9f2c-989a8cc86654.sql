-- Criar bucket para materiais da Central de Anúncios
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ad-center-materials', 'ad-center-materials', true, 5242880);

-- Políticas de acesso
CREATE POLICY "Qualquer um pode ver materiais ad center"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-center-materials');

CREATE POLICY "Admins podem fazer upload ad center"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ad-center-materials' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins podem atualizar ad center"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ad-center-materials' AND is_admin_user(auth.uid()));

CREATE POLICY "Admins podem deletar ad center"
ON storage.objects FOR DELETE
USING (bucket_id = 'ad-center-materials' AND is_admin_user(auth.uid()));