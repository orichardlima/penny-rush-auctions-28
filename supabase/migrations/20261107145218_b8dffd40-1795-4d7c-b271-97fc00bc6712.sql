CREATE TABLE public.partner_withdrawal_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.partner_withdrawals(id),
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.partner_withdrawal_receipts(withdrawal_id);
GRANT SELECT, INSERT, UPDATE ON public.partner_withdrawal_receipts TO authenticated;
GRANT ALL ON public.partner_withdrawal_receipts TO service_role;
ALTER TABLE public.partner_withdrawal_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage receipts" ON public.partner_withdrawal_receipts FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Partner reads own receipts" ON public.partner_withdrawal_receipts FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.partner_withdrawals w JOIN public.partner_contracts c ON c.id = w.partner_contract_id WHERE w.id = withdrawal_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins upload withdrawal receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'withdrawal-receipts' AND public.is_admin_user(auth.uid()));
CREATE POLICY "Read withdrawal receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'withdrawal-receipts' AND (public.is_admin_user(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.partner_withdrawal_receipts r JOIN public.partner_withdrawals w ON w.id = r.withdrawal_id
    JOIN public.partner_contracts c ON c.id = w.partner_contract_id
    WHERE r.file_path = storage.objects.name AND r.deleted_at IS NULL AND c.user_id = auth.uid())));