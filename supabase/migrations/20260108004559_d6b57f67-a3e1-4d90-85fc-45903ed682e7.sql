-- Permitir usuários criarem seus próprios contratos de parceiro
CREATE POLICY "Users can create their own contracts"
  ON public.partner_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Permitir usuários atualizarem seus próprios contratos
CREATE POLICY "Users can update their own contracts"
  ON public.partner_contracts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Permitir usuários criarem bônus de indicação para seus contratos
CREATE POLICY "Users can create referral bonuses for their referrals"
  ON public.partner_referral_bonuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    referrer_contract_id IN (
      SELECT id FROM partner_contracts 
      WHERE user_id = auth.uid()
    )
  );