
-- 1) NOVAS CONFIGURAÇÕES DE COMISSÃO POR TIPO
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES
  ('affiliate_manager_commission_rate', '50', 'number', 'Comissão do Manager (parceiro de expansão) na PRIMEIRA compra do indicado (%)'),
  ('affiliate_manager_repurchase_rate', '10', 'number', 'Comissão do Manager nas RECOMPRAS do indicado (%)'),
  ('affiliate_influencer_commission_rate', '10', 'number', 'Comissão do Influencer (convidado por Manager) na PRIMEIRA compra (%)'),
  ('affiliate_influencer_repurchase_rate', '5', 'number', 'Comissão do Influencer nas RECOMPRAS (%)'),
  ('affiliate_default_override_rate', '2', 'number', 'Override padrão do Manager sobre as comissões de seus Influencers (%)')
ON CONFLICT (setting_key) DO NOTHING;

-- 2) FUNÇÃO DE ELEGIBILIDADE
CREATE OR REPLACE FUNCTION public.get_affiliate_eligibility(_user_id uuid)
RETURNS TABLE(eligible boolean, role text, reason text, manager_affiliate_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_partner boolean;
  v_ref_code text;
  v_manager_id uuid;
BEGIN
  -- Já é afiliado? então não recria
  IF EXISTS (SELECT 1 FROM affiliates WHERE user_id = _user_id) THEN
    RETURN QUERY SELECT false, NULL::text, 'already_affiliate'::text, NULL::uuid;
    RETURN;
  END IF;

  -- 1) Parceiro de expansão ativo => Manager
  SELECT EXISTS (
    SELECT 1 FROM partner_contracts
    WHERE user_id = _user_id AND status = 'ACTIVE'
  ) INTO v_has_active_partner;

  IF v_has_active_partner THEN
    RETURN QUERY SELECT true, 'manager'::text, 'active_partner'::text, NULL::uuid;
    RETURN;
  END IF;

  -- 2) Convidado por Manager via source_manager_affiliate_id no perfil (se existir lookup futuro)
  --    O fluxo principal de convite usa o referral code armazenado no client; a validação final
  --    de Influencer ocorre no helper, que passa o código via createAffiliateAccount.
  -- Aqui apenas indicamos que SEM parceria + SEM código de manager => bloqueado.
  RETURN QUERY SELECT false, NULL::text, 'not_partner_and_no_manager_invite'::text, NULL::uuid;
END;
$$;

-- 3) FUNÇÃO PARA RESOLVER UM CÓDIGO DE INDICAÇÃO COMO MANAGER VÁLIDO
CREATE OR REPLACE FUNCTION public.resolve_manager_by_ref_code(_ref_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM affiliates
  WHERE affiliate_code = _ref_code
    AND role = 'manager'
    AND status = 'active'
  LIMIT 1;
$$;

-- 4) RLS: substituir o INSERT permissivo por um INSERT restrito por elegibilidade
DROP POLICY IF EXISTS "Users can insert own affiliate account" ON public.affiliates;

CREATE POLICY "Users can insert own affiliate account (restricted)"
ON public.affiliates
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND role IN ('manager', 'influencer')
  AND (
    -- Caso 1: parceiro ativo virando manager
    (
      role = 'manager'
      AND EXISTS (
        SELECT 1 FROM partner_contracts pc
        WHERE pc.user_id = auth.uid() AND pc.status = 'ACTIVE'
      )
    )
    OR
    -- Caso 2: influencer recrutado por um manager válido
    (
      role = 'influencer'
      AND source_manager_affiliate_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM affiliates m
        WHERE m.id = source_manager_affiliate_id
          AND m.role = 'manager'
          AND m.status = 'active'
      )
    )
  )
);

-- 5) BACKFILL: promover parceiros ativos atuais a Manager
-- 5a) Atualizar afiliados já existentes que tenham contrato ativo para role='manager' e status='active'
UPDATE public.affiliates a
SET role = 'manager',
    status = 'active',
    approved_at = COALESCE(a.approved_at, now()),
    commission_rate = GREATEST(a.commission_rate, 50)
WHERE a.role <> 'manager'
  AND EXISTS (
    SELECT 1 FROM partner_contracts pc
    WHERE pc.user_id = a.user_id AND pc.status = 'ACTIVE'
  );

-- 5b) Criar conta de afiliado (manager) para parceiros ativos que ainda não têm
INSERT INTO public.affiliates (
  user_id, affiliate_code, role, status, commission_rate, repurchase_commission_rate,
  approved_at, total_referrals, total_conversions, commission_balance,
  total_commission_earned, total_commission_paid
)
SELECT DISTINCT ON (pc.user_id)
  pc.user_id,
  -- código baseado em primeiro nome do profile (fallback PARTNER) + sufixo do uuid
  UPPER(
    COALESCE(
      NULLIF(regexp_replace(split_part(p.full_name, ' ', 1), '[^A-Za-z]', '', 'g'), ''),
      'PARTNER'
    )
  ) || UPPER(SUBSTRING(REPLACE(pc.user_id::text, '-', '') FROM 29 FOR 4)),
  'manager',
  'active',
  50,
  10,
  now(),
  0, 0, 0, 0, 0
FROM partner_contracts pc
LEFT JOIN profiles p ON p.user_id = pc.user_id
WHERE pc.status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM affiliates a WHERE a.user_id = pc.user_id)
ON CONFLICT DO NOTHING;
