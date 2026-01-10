-- 1. Adicionar coluna referral_level na tabela partner_referral_bonuses
ALTER TABLE partner_referral_bonuses 
ADD COLUMN IF NOT EXISTS referral_level INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN partner_referral_bonuses.referral_level IS 
  '1 = indicação direta, 2 = segundo nível, 3 = terceiro nível';

-- 2. Criar tabela de configuração de níveis de indicação
CREATE TABLE IF NOT EXISTS referral_level_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level INTEGER NOT NULL UNIQUE,
  percentage NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- Inserir configurações padrão dos níveis
INSERT INTO referral_level_config (level, percentage, description) VALUES
  (1, 0, 'Indicação direta - usa porcentagem do plano'),
  (2, 2, 'Segundo nível - 2%'),
  (3, 0.5, 'Terceiro nível - 0.5%')
ON CONFLICT (level) DO NOTHING;

-- Habilitar RLS
ALTER TABLE referral_level_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage referral level config"
ON referral_level_config FOR ALL
USING (is_admin_user(auth.uid()));

CREATE POLICY "Anyone can view referral level config"
ON referral_level_config FOR SELECT
USING (true);

-- 3. Criar função para gerar bônus em cascata
CREATE OR REPLACE FUNCTION create_cascade_referral_bonuses()
RETURNS TRIGGER AS $$
DECLARE
  v_level1_contract RECORD;
  v_level2_contract RECORD;
  v_level3_contract RECORD;
  v_level1_plan RECORD;
  v_level2_config RECORD;
  v_level3_config RECORD;
  v_level1_points INTEGER;
  v_level2_points INTEGER;
  v_level3_points INTEGER;
  v_bonus_value NUMERIC;
BEGIN
  -- Só processa se tiver código de indicação
  IF NEW.referred_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ========== NÍVEL 1: Indicador Direto ==========
  SELECT * INTO v_level1_contract
  FROM partner_contracts
  WHERE user_id = NEW.referred_by_user_id
    AND status = 'ACTIVE'
  LIMIT 1;

  IF v_level1_contract.id IS NOT NULL THEN
    -- Buscar porcentagem do plano do indicador
    SELECT * INTO v_level1_plan
    FROM partner_plans
    WHERE name = v_level1_contract.plan_name
    LIMIT 1;

    -- Buscar pontos do plano do indicado
    SELECT COALESCE(points, 0) INTO v_level1_points
    FROM partner_level_points
    WHERE plan_name = NEW.plan_name;

    -- Calcular bônus nível 1 (usa % do plano)
    v_bonus_value := NEW.aporte_value * (COALESCE(v_level1_plan.referral_bonus_percentage, 10) / 100);

    -- Criar bônus nível 1
    INSERT INTO partner_referral_bonuses (
      referrer_contract_id,
      referred_contract_id,
      referred_user_id,
      aporte_value,
      bonus_percentage,
      bonus_value,
      referral_level,
      status
    ) VALUES (
      v_level1_contract.id,
      NEW.id,
      NEW.user_id,
      NEW.aporte_value,
      COALESCE(v_level1_plan.referral_bonus_percentage, 10),
      v_bonus_value,
      1,
      'PENDING'
    );

    -- Atualizar pontos do indicador nível 1
    UPDATE partner_contracts
    SET total_referral_points = total_referral_points + COALESCE(v_level1_points, 0),
        updated_at = NOW()
    WHERE id = v_level1_contract.id;

    -- ========== NÍVEL 2: Avô do indicado ==========
    IF v_level1_contract.referred_by_user_id IS NOT NULL THEN
      SELECT * INTO v_level2_contract
      FROM partner_contracts
      WHERE user_id = v_level1_contract.referred_by_user_id
        AND status = 'ACTIVE'
      LIMIT 1;

      IF v_level2_contract.id IS NOT NULL THEN
        -- Buscar configuração do nível 2
        SELECT * INTO v_level2_config
        FROM referral_level_config
        WHERE level = 2 AND is_active = true;

        IF v_level2_config.id IS NOT NULL AND v_level2_config.percentage > 0 THEN
          -- Calcular bônus nível 2
          v_bonus_value := NEW.aporte_value * (v_level2_config.percentage / 100);

          -- Buscar pontos (metade do nível 1)
          v_level2_points := COALESCE(v_level1_points / 2, 0);

          -- Criar bônus nível 2
          INSERT INTO partner_referral_bonuses (
            referrer_contract_id,
            referred_contract_id,
            referred_user_id,
            aporte_value,
            bonus_percentage,
            bonus_value,
            referral_level,
            status
          ) VALUES (
            v_level2_contract.id,
            NEW.id,
            NEW.user_id,
            NEW.aporte_value,
            v_level2_config.percentage,
            v_bonus_value,
            2,
            'PENDING'
          );

          -- Atualizar pontos do indicador nível 2
          UPDATE partner_contracts
          SET total_referral_points = total_referral_points + v_level2_points,
              updated_at = NOW()
          WHERE id = v_level2_contract.id;

          -- ========== NÍVEL 3: Bisavô do indicado ==========
          IF v_level2_contract.referred_by_user_id IS NOT NULL THEN
            SELECT * INTO v_level3_contract
            FROM partner_contracts
            WHERE user_id = v_level2_contract.referred_by_user_id
              AND status = 'ACTIVE'
            LIMIT 1;

            IF v_level3_contract.id IS NOT NULL THEN
              -- Buscar configuração do nível 3
              SELECT * INTO v_level3_config
              FROM referral_level_config
              WHERE level = 3 AND is_active = true;

              IF v_level3_config.id IS NOT NULL AND v_level3_config.percentage > 0 THEN
                -- Calcular bônus nível 3
                v_bonus_value := NEW.aporte_value * (v_level3_config.percentage / 100);

                -- Buscar pontos (1/4 do nível 1)
                v_level3_points := COALESCE(v_level1_points / 4, 0);

                -- Criar bônus nível 3
                INSERT INTO partner_referral_bonuses (
                  referrer_contract_id,
                  referred_contract_id,
                  referred_user_id,
                  aporte_value,
                  bonus_percentage,
                  bonus_value,
                  referral_level,
                  status
                ) VALUES (
                  v_level3_contract.id,
                  NEW.id,
                  NEW.user_id,
                  NEW.aporte_value,
                  v_level3_config.percentage,
                  v_bonus_value,
                  3,
                  'PENDING'
                );

                -- Atualizar pontos do indicador nível 3
                UPDATE partner_contracts
                SET total_referral_points = total_referral_points + v_level3_points,
                    updated_at = NOW()
                WHERE id = v_level3_contract.id;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Criar trigger para novos contratos
DROP TRIGGER IF EXISTS on_partner_contract_created_cascade ON partner_contracts;
CREATE TRIGGER on_partner_contract_created_cascade
  AFTER INSERT ON partner_contracts
  FOR EACH ROW
  EXECUTE FUNCTION create_cascade_referral_bonuses();