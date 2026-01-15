-- Permitir que qualquer pessoa possa buscar contratos ativos pelo referral_code
-- Isso é necessário para mostrar o nome do patrocinador na tela de cadastro
CREATE POLICY "Anyone can view active contracts by referral_code"
  ON partner_contracts
  FOR SELECT
  USING (status = 'ACTIVE');