
-- Enum for categories
DO $$ BEGIN
  CREATE TYPE public.download_category AS ENUM ('contrato','apresentacao','kit_divulgacao','regulamento','outros');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Main table
CREATE TABLE public.platform_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category public.download_category NOT NULL DEFAULT 'outros',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  download_count int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_downloads TO authenticated;
GRANT ALL ON public.platform_downloads TO service_role;

ALTER TABLE public.platform_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active downloads"
ON public.platform_downloads FOR SELECT TO authenticated
USING (is_active = true OR public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert downloads"
ON public.platform_downloads FOR INSERT TO authenticated
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update downloads"
ON public.platform_downloads FOR UPDATE TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete downloads"
ON public.platform_downloads FOR DELETE TO authenticated
USING (public.is_admin_user(auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_platform_downloads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_platform_downloads_updated_at
BEFORE UPDATE ON public.platform_downloads
FOR EACH ROW EXECUTE FUNCTION public.tg_platform_downloads_updated_at();

-- RPC to increment download counter safely (any authenticated user)
CREATE OR REPLACE FUNCTION public.increment_platform_download(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.platform_downloads
  SET download_count = download_count + 1
  WHERE id = p_id AND is_active = true;
END $$;

GRANT EXECUTE ON FUNCTION public.increment_platform_download(uuid) TO authenticated;

-- Storage RLS policies for platform-downloads bucket
CREATE POLICY "Authenticated can read platform-downloads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'platform-downloads');

CREATE POLICY "Admins can upload platform-downloads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'platform-downloads' AND public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update platform-downloads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'platform-downloads' AND public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete platform-downloads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'platform-downloads' AND public.is_admin_user(auth.uid()));
