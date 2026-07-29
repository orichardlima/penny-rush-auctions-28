
-- ============================================================
-- FASE 1: PROGRAMA DE EXPANSÃO POR EQUIPES — Fundação
-- ============================================================

-- ---------- 1. FEATURE FLAGS / SETTINGS ----------
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('binary_system_enabled', 'false', 'boolean', 'Sistema binário legado (desligado após migração para Expansão)'),
  ('expansion_program_enabled', 'true', 'boolean', 'Programa de Expansão por Equipes ativo'),
  ('expansion_bonus_payout_enabled', 'false', 'boolean', 'Pagamento financeiro do Bônus de Expansão ligado'),
  ('expansion_career_enabled', 'true', 'boolean', 'Cálculo de carreira do Programa de Expansão ativo'),
  ('expansion_points_generation_enabled', 'true', 'boolean', 'Geração automática de Pontos de Expansão em ativações/upgrades'),
  ('expansion_points_migration_mode', 'start_from_cutoff', 'text', 'Modo de migração: start_from_cutoff | recalculate_active_contracts | manual_import'),
  ('expansion_cutoff_at', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'text', 'Data de corte — apenas eventos após esta data geram pontos automaticamente'),
  ('expansion_plan_points', '{"Fundador":0,"START":50,"PRO":150,"ELITE":400,"Master":600,"Legend":1000,"Diamond":2500}', 'json', 'Pontos de Expansão por plano')
ON CONFLICT (setting_key) DO NOTHING;

-- ---------- 2. TABELAS ----------

-- 2.1 LEDGER DE PONTOS
CREATE TABLE public.expansion_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  plan_name TEXT,
  points INTEGER NOT NULL,
  source TEXT NOT NULL, -- 'contract_activation' | 'contract_upgrade' | 'admin_adjustment' | 'reversal'
  source_ref TEXT NOT NULL UNIQUE, -- idempotência
  reverses_id UUID REFERENCES public.expansion_points_ledger(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED | REVERSED | PENDING
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_id UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_epl_user ON public.expansion_points_ledger(user_id, created_at DESC);
CREATE INDEX idx_epl_contract ON public.expansion_points_ledger(contract_id);
CREATE INDEX idx_epl_status ON public.expansion_points_ledger(status) WHERE status = 'CONFIRMED';

GRANT SELECT ON public.expansion_points_ledger TO authenticated;
GRANT ALL ON public.expansion_points_ledger TO service_role;
ALTER TABLE public.expansion_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY epl_own_read ON public.expansion_points_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 2.2 MEMBERSHIPS (cache de árvore)
CREATE TABLE public.expansion_team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ancestor_user_id UUID NOT NULL,        -- parceiro que "possui" a equipe
  descendant_user_id UUID NOT NULL,      -- integrante da organização
  team_root_user_id UUID NOT NULL,       -- 1ª indicação direta no caminho ancestor→descendant (=raiz da equipe)
  depth INTEGER NOT NULL,                -- profundidade em relação ao ancestor (1 = indicado direto)
  descendant_contract_id UUID REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ancestor_user_id, descendant_user_id)
);
CREATE INDEX idx_etm_ancestor ON public.expansion_team_memberships(ancestor_user_id, team_root_user_id);
CREATE INDEX idx_etm_descendant ON public.expansion_team_memberships(descendant_user_id);
CREATE INDEX idx_etm_team_root ON public.expansion_team_memberships(team_root_user_id);

GRANT SELECT ON public.expansion_team_memberships TO authenticated;
GRANT ALL ON public.expansion_team_memberships TO service_role;
ALTER TABLE public.expansion_team_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY etm_own_read ON public.expansion_team_memberships FOR SELECT TO authenticated
  USING (ancestor_user_id = auth.uid() OR descendant_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 2.3 CAREER CONFIG (regras configuráveis por graduação)
CREATE TABLE public.expansion_career_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_key TEXT NOT NULL UNIQUE,          -- BRONZE|PRATA|OURO|PLATINA|DIAMANTE
  rank_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  min_organizational_points INTEGER NOT NULL DEFAULT 0,
  min_qualified_teams INTEGER NOT NULL DEFAULT 0,
  max_team_concentration_pct NUMERIC NOT NULL DEFAULT 100, -- % máximo de uma equipe no volume
  min_qualified_team_points INTEGER NOT NULL DEFAULT 0,    -- pontos p/ equipe ser considerada qualificada
  min_active_partners_per_team INTEGER NOT NULL DEFAULT 0,
  required_leaders JSONB NOT NULL DEFAULT '[]'::jsonb,     -- ex: [{"rank":"BRONZE","count":1}]
  reward_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expansion_career_config TO authenticated;
GRANT ALL ON public.expansion_career_config TO service_role;
ALTER TABLE public.expansion_career_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecc_read ON public.expansion_career_config FOR SELECT TO authenticated USING (true);
CREATE POLICY ecc_admin_write ON public.expansion_career_config FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

INSERT INTO public.expansion_career_config
  (rank_key, rank_label, sort_order, min_organizational_points, min_qualified_teams, max_team_concentration_pct, min_qualified_team_points, min_active_partners_per_team, required_leaders)
VALUES
  ('BRONZE','Bronze',1,1000,2,70,300,1,'[]'::jsonb),
  ('PRATA','Prata',2,4000,2,60,1000,1,'[{"rank":"BRONZE","count":1}]'::jsonb),
  ('OURO','Ouro',3,10000,3,50,2500,1,'[{"rank":"PRATA","count":2,"distinct_teams":true}]'::jsonb),
  ('PLATINA','Platina',4,30000,3,50,7500,1,'[{"rank":"OURO","count":2,"distinct_teams":true}]'::jsonb),
  ('DIAMANTE','Diamante',5,100000,4,40,25000,1,'[{"rank":"PLATINA","count":3,"distinct_teams":true}]'::jsonb);

-- 2.4 PERIOD SNAPSHOTS
CREATE TABLE public.expansion_period_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  personal_points INTEGER NOT NULL DEFAULT 0,
  organizational_points INTEGER NOT NULL DEFAULT 0,
  points_by_team JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {team_root_user_id: points}
  qualified_teams_count INTEGER NOT NULL DEFAULT 0,
  concentration_pct NUMERIC NOT NULL DEFAULT 0,
  rank_achieved TEXT,
  rank_qualified TEXT,
  simulated_bonus_value NUMERIC NOT NULL DEFAULT 0,
  weekly_cap NUMERIC NOT NULL DEFAULT 0,
  computation_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);
CREATE INDEX idx_eps_user_period ON public.expansion_period_snapshots(user_id, period_start DESC);
GRANT SELECT ON public.expansion_period_snapshots TO authenticated;
GRANT ALL ON public.expansion_period_snapshots TO service_role;
ALTER TABLE public.expansion_period_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY eps_own_read ON public.expansion_period_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 2.5 BONUS LINES
CREATE TABLE public.expansion_bonus_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.expansion_period_snapshots(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  eligible_points INTEGER NOT NULL DEFAULT 0,
  qualified_teams_count INTEGER NOT NULL DEFAULT 0,
  rank_used TEXT,
  factor_applied NUMERIC NOT NULL DEFAULT 0,
  cap_applied NUMERIC NOT NULL DEFAULT 0,
  gross_value NUMERIC NOT NULL DEFAULT 0,
  adjustments NUMERIC NOT NULL DEFAULT 0,
  final_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SIMULATED', -- SIMULATED | APPROVED | PAID | REVERSED | BLOCKED
  payout_ref UUID,
  paid_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ebl_user_period ON public.expansion_bonus_lines(user_id, period_start DESC);
CREATE INDEX idx_ebl_status ON public.expansion_bonus_lines(status);
GRANT SELECT ON public.expansion_bonus_lines TO authenticated;
GRANT ALL ON public.expansion_bonus_lines TO service_role;
ALTER TABLE public.expansion_bonus_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY ebl_own_read ON public.expansion_bonus_lines FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 2.6 ADMIN AUDIT
CREATE TABLE public.expansion_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eaa_admin ON public.expansion_admin_audit(admin_id, created_at DESC);
GRANT SELECT, INSERT ON public.expansion_admin_audit TO authenticated;
GRANT ALL ON public.expansion_admin_audit TO service_role;
ALTER TABLE public.expansion_admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY eaa_admin_read ON public.expansion_admin_audit FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));
CREATE POLICY eaa_admin_insert ON public.expansion_admin_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()) AND admin_id = auth.uid());

-- ---------- 3. FUNÇÕES ----------

-- 3.1 Recomputa memberships de um contrato (chamado ao ativar/mover)
CREATE OR REPLACE FUNCTION public.expansion_recompute_memberships(_contract_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_referrer UUID;
  v_ancestor UUID;
  v_prev UUID;
  v_depth INT := 0;
  v_inserted INT := 0;
BEGIN
  SELECT user_id, referred_by_user_id INTO v_user, v_referrer
  FROM public.partner_contracts WHERE id = _contract_id;
  IF v_user IS NULL THEN RETURN 0; END IF;

  -- limpa memberships onde este user é descendant
  DELETE FROM public.expansion_team_memberships WHERE descendant_user_id = v_user;

  IF v_referrer IS NULL THEN RETURN 0; END IF;

  -- Sobe a árvore de patrocínio via partner_contracts.referred_by_user_id
  v_prev := v_user;               -- filho corrente
  v_ancestor := v_referrer;       -- ancestor imediato
  WHILE v_ancestor IS NOT NULL LOOP
    v_depth := v_depth + 1;
    -- team_root para este ancestor = filho direto no caminho = v_prev
    INSERT INTO public.expansion_team_memberships
      (ancestor_user_id, descendant_user_id, team_root_user_id, depth, descendant_contract_id)
    VALUES (v_ancestor, v_user, v_prev, v_depth, _contract_id)
    ON CONFLICT (ancestor_user_id, descendant_user_id) DO UPDATE
      SET team_root_user_id = EXCLUDED.team_root_user_id,
          depth = EXCLUDED.depth,
          descendant_contract_id = EXCLUDED.descendant_contract_id;
    v_inserted := v_inserted + 1;
    IF v_depth > 50 THEN EXIT; END IF; -- safety
    -- próximo ancestor
    v_prev := v_ancestor;
    SELECT referred_by_user_id INTO v_ancestor
    FROM public.partner_contracts
    WHERE user_id = v_ancestor AND status='ACTIVE'
    ORDER BY created_at ASC LIMIT 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- 3.2 Gera Pontos de Expansão para um contrato (idempotente)
CREATE OR REPLACE FUNCTION public.expansion_credit_contract_activation(_contract_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_gen_enabled BOOLEAN;
  v_cutoff TIMESTAMPTZ;
  v_plan_points JSONB;
  v_user UUID;
  v_plan TEXT;
  v_created TIMESTAMPTZ;
  v_points INT;
BEGIN
  SELECT (setting_value::boolean) INTO v_gen_enabled FROM public.system_settings WHERE setting_key='expansion_points_generation_enabled';
  IF NOT COALESCE(v_gen_enabled,false) THEN RETURN 0; END IF;

  SELECT setting_value::timestamptz INTO v_cutoff FROM public.system_settings WHERE setting_key='expansion_cutoff_at';
  SELECT setting_value::jsonb INTO v_plan_points FROM public.system_settings WHERE setting_key='expansion_plan_points';

  SELECT user_id, plan_name, created_at INTO v_user, v_plan, v_created
  FROM public.partner_contracts WHERE id = _contract_id AND status='ACTIVE';
  IF v_user IS NULL THEN RETURN 0; END IF;
  IF v_cutoff IS NOT NULL AND v_created < v_cutoff THEN RETURN 0; END IF;

  v_points := COALESCE((v_plan_points ->> v_plan)::int, 0);
  IF v_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.expansion_points_ledger
    (user_id, contract_id, plan_name, points, source, source_ref, status, metadata)
  VALUES
    (v_user, _contract_id, v_plan, v_points, 'contract_activation', _contract_id::text || ':activation', 'CONFIRMED',
     jsonb_build_object('plan', v_plan))
  ON CONFLICT (source_ref) DO NOTHING;

  RETURN v_points;
END;
$$;

-- 3.3 Gera pontos delta em upgrade (idempotente)
CREATE OR REPLACE FUNCTION public.expansion_credit_upgrade(_upgrade_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_gen_enabled BOOLEAN;
  v_cutoff TIMESTAMPTZ;
  v_plan_points JSONB;
  v_prev TEXT; v_new TEXT;
  v_user UUID; v_contract UUID; v_created TIMESTAMPTZ;
  v_delta INT;
BEGIN
  SELECT (setting_value::boolean) INTO v_gen_enabled FROM public.system_settings WHERE setting_key='expansion_points_generation_enabled';
  IF NOT COALESCE(v_gen_enabled,false) THEN RETURN 0; END IF;
  SELECT setting_value::timestamptz INTO v_cutoff FROM public.system_settings WHERE setting_key='expansion_cutoff_at';
  SELECT setting_value::jsonb INTO v_plan_points FROM public.system_settings WHERE setting_key='expansion_plan_points';

  SELECT u.previous_plan_name, u.new_plan_name, u.created_at, u.partner_contract_id, c.user_id
  INTO v_prev, v_new, v_created, v_contract, v_user
  FROM public.partner_upgrades u
  JOIN public.partner_contracts c ON c.id = u.partner_contract_id
  WHERE u.id = _upgrade_id;
  IF v_user IS NULL THEN RETURN 0; END IF;
  IF v_cutoff IS NOT NULL AND v_created < v_cutoff THEN RETURN 0; END IF;

  v_delta := COALESCE((v_plan_points ->> v_new)::int, 0) - COALESCE((v_plan_points ->> v_prev)::int, 0);
  IF v_delta <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.expansion_points_ledger
    (user_id, contract_id, plan_name, points, source, source_ref, status, metadata)
  VALUES
    (v_user, v_contract, v_new, v_delta, 'contract_upgrade', _upgrade_id::text || ':upgrade', 'CONFIRMED',
     jsonb_build_object('from', v_prev, 'to', v_new));
  RETURN v_delta;
END;
$$;

-- 3.4 Reverte pontos em cancelamento (idempotente por source_ref)
CREATE OR REPLACE FUNCTION public.expansion_reverse_contract(_contract_id UUID, _reason TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD; v_count INT := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, plan_name, points, contract_id, source_ref
    FROM public.expansion_points_ledger
    WHERE contract_id = _contract_id AND status='CONFIRMED' AND points > 0
  LOOP
    INSERT INTO public.expansion_points_ledger
      (user_id, contract_id, plan_name, points, source, source_ref, reverses_id, status, reason)
    VALUES
      (r.user_id, r.contract_id, r.plan_name, -r.points, 'reversal', r.source_ref || ':reversal', r.id, 'CONFIRMED', _reason)
    ON CONFLICT (source_ref) DO NOTHING;
    UPDATE public.expansion_points_ledger SET status='REVERSED' WHERE id = r.id AND status='CONFIRMED';
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ---------- 4. TRIGGERS ----------

CREATE OR REPLACE FUNCTION public.trg_expansion_on_contract()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.status='ACTIVE' THEN
    PERFORM public.expansion_recompute_memberships(NEW.id);
    PERFORM public.expansion_credit_contract_activation(NEW.id);
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.status='ACTIVE' AND COALESCE(OLD.status,'') <> 'ACTIVE' THEN
      PERFORM public.expansion_recompute_memberships(NEW.id);
      PERFORM public.expansion_credit_contract_activation(NEW.id);
    ELSIF OLD.status='ACTIVE' AND NEW.status IN ('CANCELLED','TERMINATED','EXPIRED','CLOSED') THEN
      PERFORM public.expansion_reverse_contract(NEW.id, 'status_change:'||NEW.status);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_expansion_on_contract ON public.partner_contracts;
CREATE TRIGGER trg_expansion_on_contract
AFTER INSERT OR UPDATE ON public.partner_contracts
FOR EACH ROW EXECUTE FUNCTION public.trg_expansion_on_contract();

CREATE OR REPLACE FUNCTION public.trg_expansion_on_upgrade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.expansion_credit_upgrade(NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_expansion_on_upgrade ON public.partner_upgrades;
CREATE TRIGGER trg_expansion_on_upgrade
AFTER INSERT ON public.partner_upgrades
FOR EACH ROW EXECUTE FUNCTION public.trg_expansion_on_upgrade();

-- ---------- 5. RPCs DE LEITURA ----------

-- 5.1 Dashboard resumo
CREATE OR REPLACE FUNCTION public.get_expansion_dashboard(_user_id UUID DEFAULT auth.uid())
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_personal INT := 0;
  v_org INT := 0;
  v_week INT := 0;
  v_month INT := 0;
  v_teams INT := 0;
  v_partners INT := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT COALESCE(SUM(points),0) INTO v_personal
  FROM public.expansion_points_ledger WHERE user_id=_user_id AND status='CONFIRMED';

  SELECT COALESCE(SUM(l.points),0) INTO v_org
  FROM public.expansion_team_memberships m
  JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id AND l.status='CONFIRMED'
  WHERE m.ancestor_user_id = _user_id;

  SELECT COALESCE(SUM(l.points),0) INTO v_week
  FROM public.expansion_team_memberships m
  JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id AND l.status='CONFIRMED'
  WHERE m.ancestor_user_id = _user_id AND l.created_at >= date_trunc('week', now());

  SELECT COALESCE(SUM(l.points),0) INTO v_month
  FROM public.expansion_team_memberships m
  JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id AND l.status='CONFIRMED'
  WHERE m.ancestor_user_id = _user_id AND l.created_at >= date_trunc('month', now());

  SELECT COUNT(DISTINCT team_root_user_id) INTO v_teams
  FROM public.expansion_team_memberships WHERE ancestor_user_id = _user_id;

  SELECT COUNT(DISTINCT descendant_user_id) INTO v_partners
  FROM public.expansion_team_memberships WHERE ancestor_user_id = _user_id;

  RETURN jsonb_build_object(
    'personal_points', v_personal,
    'organizational_points', v_org,
    'week_points', v_week,
    'month_points', v_month,
    'teams_count', v_teams,
    'partners_count', v_partners
  );
END; $$;

-- 5.2 Lista de equipes com totais
CREATE OR REPLACE FUNCTION public.get_expansion_teams(_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  team_root_user_id UUID,
  team_root_name TEXT,
  team_root_plan TEXT,
  members_count INTEGER,
  total_points BIGINT,
  week_points BIGINT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  IF _user_id <> auth.uid() AND NOT public.is_admin_user(auth.uid()) THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    m.team_root_user_id,
    COALESCE(p.full_name, p.email, 'Parceiro')::text AS team_root_name,
    (SELECT plan_name FROM public.partner_contracts WHERE user_id = m.team_root_user_id AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1) AS team_root_plan,
    COUNT(DISTINCT m.descendant_user_id)::int AS members_count,
    COALESCE(SUM(CASE WHEN l.status='CONFIRMED' THEN l.points ELSE 0 END),0)::bigint AS total_points,
    COALESCE(SUM(CASE WHEN l.status='CONFIRMED' AND l.created_at >= date_trunc('week', now()) THEN l.points ELSE 0 END),0)::bigint AS week_points
  FROM public.expansion_team_memberships m
  LEFT JOIN public.expansion_points_ledger l ON l.user_id = m.descendant_user_id
  LEFT JOIN public.profiles p ON p.user_id = m.team_root_user_id
  WHERE m.ancestor_user_id = _user_id
  GROUP BY m.team_root_user_id, p.full_name, p.email
  ORDER BY total_points DESC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_expansion_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expansion_teams(UUID) TO authenticated;

-- ---------- 6. BACKFILL DE MEMBERSHIPS ----------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.partner_contracts WHERE status='ACTIVE' AND referred_by_user_id IS NOT NULL LOOP
    PERFORM public.expansion_recompute_memberships(r.id);
  END LOOP;
END $$;

-- ---------- 7. MARCAR TABELAS BINÁRIAS COMO LEGADO (somente comentário) ----------
COMMENT ON TABLE public.partner_binary_positions IS 'LEGADO — sistema binário desativado. Preservado somente-leitura para auditoria (Programa de Expansão por Equipes).';
COMMENT ON TABLE public.binary_bonuses IS 'LEGADO — bônus binário desativado. Substituído por expansion_bonus_lines.';
COMMENT ON TABLE public.binary_cycle_closures IS 'LEGADO — ciclos binários encerrados.';
COMMENT ON TABLE public.binary_points_log IS 'LEGADO — logs binários preservados para auditoria.';
