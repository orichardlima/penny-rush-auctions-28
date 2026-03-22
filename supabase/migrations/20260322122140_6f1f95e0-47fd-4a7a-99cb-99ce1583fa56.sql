-- Allow affiliates to update their own pix_key and bank_details
CREATE POLICY "Affiliates can update own pix details"
ON public.affiliates
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Insert min withdrawal setting
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES ('affiliate_min_withdrawal', '50', 'number', 'Valor mínimo para saque de afiliado (R$)')
ON CONFLICT (setting_key) DO NOTHING;