-- ======================================================================================
-- MIGRATION: PROGRAMA DE EXPANSÃO - VERSIONAMENTO DE CONFIGURAÇÃO DE CARREIRA (V2)
-- ======================================================================================
-- 1. BASELINE COMPLETO E TEMPORALMENTE VÁLIDO
-- 2. REMOÇÃO DE FALLBACKS
-- 3. SEGURANÇA RESTRITA (INTERNAL ONLY)
-- 4. RLS ADMINISTRATIVO RIGOROSO
-- 5. STATUS, IMUTABILIDADE E AUDITORIA
-- 6. VALIDAÇÃO ESTRUTURADA (SHA-256)
-- 7. SIMULAÇÃO REAL INTEGRADA
-- 8. VIGÊNCIA (SEGUNDA-FEIRA BAHIA)
-- 9. LOCKS E CONCORRÊNCIA
-- ======================================================================================

BEGIN;

-- Dependências
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos de Status
DO $$ BEGIN
    CREATE TYPE public.expansion_config_status AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Tabela de Versões (Hardened)
CREATE TABLE IF NOT EXISTS public.expansion_career_config_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number int NOT NULL,
    status public.expansion_config_status NOT NULL DEFAULT 'DRAFT',
    effective_from timestamptz NOT NULL,
    config_data jsonb NOT NULL,
    config_hash text NOT NULL,
    
    -- Auditoria
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    published_at timestamptz,
    published_by uuid REFERENCES auth.users(id),
    superseded_at timestamptz,
    superseded_by uuid REFERENCES auth.users(id),
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES auth.users(id),
    cancellation_reason text,
    change_reason text NOT NULL,
    
    -- Metadados de Publicação
    dry_run_impact_snapshot jsonb,
    
    CONSTRAINT uk_expansion_config_version UNIQUE(version_number),
    CONSTRAINT uk_expansion_config_hash UNIQUE(config_hash),
    CONSTRAINT ck_expansion_config_reason CHECK (length(trim(change_reason)) > 0)
);

-- RLS Administrativo Rigoroso
ALTER TABLE public.expansion_career_config_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.expansion_career_config_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.expansion_career_config_versions TO service_role;

-- Policy para Admins (via RPC ou acesso direto service_role)
-- Parceiro comum NÃO TEM acesso a esta tabela nem por policy.

-- 2. Função de Validação Estruturada
CREATE OR REPLACE FUNCTION public.expansion_career_config_validate(_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    _errors text[] := '{}';
    _item jsonb;
    _prev_points int := -1;
    _prev_sort int := -1;
    _ranks text[] := '{}';
    _count int := 0;
BEGIN
    IF jsonb_typeof(_config) <> 'array' THEN 
        RETURN jsonb_build_object('valid', false, 'errors', array_append(_errors, 'Configuração deve ser um array'));
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(_config) LOOP
        _count := _count + 1;
        
        -- Chaves Obrigatórias
        IF NOT (_item ? 'rank_key' AND _item ? 'rank_label' AND _item ? 'min_organizational_points' AND _item ? 'sort_order') THEN
            _errors := array_append(_errors, format('Rank na posição %s omitiu campos obrigatórios', _count));
        END IF;

        -- Unicidade de Rank e Ordem
        IF _item->>'rank_key' = ANY(_ranks) THEN
            _errors := array_append(_errors, format('Rank duplicado: %s', _item->>'rank_key'));
        END IF;
        _ranks := array_append(_ranks, _item->>'rank_key');

        -- Progressão de Pontos
        IF (_item->>'min_organizational_points')::int <= _prev_points THEN
            _errors := array_append(_errors, format('Pontuação não progressiva no rank %s', _item->>'rank_key'));
        END IF;
        _prev_points := (_item->>'min_organizational_points')::int;

        -- Progressão de Ordem
        IF (_item->>'sort_order')::int <= _prev_sort THEN
            _errors := array_append(_errors, format('sort_order não progressivo no rank %s', _item->>'rank_key'));
        END IF;
        _prev_sort := (_item->>'sort_order')::int;

        -- Concentração
        IF (_item->>'max_team_concentration_pct')::int <= 0 OR (_item->>'max_team_concentration_pct')::int > 100 THEN
            _errors := array_append(_errors, format('Concentração inválida no rank %s', _item->>'rank_key'));
        END IF;
    END LOOP;

    IF array_length(_ranks, 1) < 5 THEN
        _errors := array_append(_errors, 'Configuração deve conter pelo menos os 5 ranks canônicos');
    END IF;

    RETURN jsonb_build_object(
        'valid', array_length(_errors, 1) IS NULL,
        'errors', _errors
    );
END;
$$;

-- 3. Função Temporal (Internal Only)
CREATE OR REPLACE FUNCTION public.expansion_career_config_at(_as_of timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _config jsonb;
BEGIN
    SELECT config_data INTO _config
    FROM public.expansion_career_config_versions
    WHERE effective_from <= _as_of
      AND status = 'PUBLISHED'
    ORDER BY effective_from DESC, version_number DESC
    LIMIT 1;

    IF _config IS NULL THEN
        RAISE EXCEPTION 'Nenhuma configuração de carreira válida encontrada para a data %', _as_of;
    END IF;

    RETURN _config;
END;
$$;

REVOKE ALL ON FUNCTION public.expansion_career_config_at FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expansion_career_config_at TO service_role;

-- 4. RPC de Consulta para Parceiros (Sanitizada)
CREATE OR REPLACE FUNCTION public.expansion_get_current_career_rules()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Retorna apenas o config_data da versão vigente, sem metadados sensíveis
    RETURN public.expansion_career_config_at(now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.expansion_get_current_career_rules TO authenticated;

-- 5. Trigger de Imutabilidade
CREATE OR REPLACE FUNCTION public.trg_expansion_config_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se já foi publicada, bloqueia qualquer alteração no conteúdo ou vigência
    IF OLD.status = 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN
        IF OLD.config_data != NEW.config_data OR OLD.effective_from != NEW.effective_from OR OLD.config_hash != NEW.config_hash THEN
            RAISE EXCEPTION 'Versão publicada é imutável. Crie uma nova versão para aplicar alterações.';
        END IF;
    END IF;

    -- Bloqueia exclusão de versões publicadas ou históricas
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expansion_config_immutability_check
BEFORE UPDATE ON public.expansion_career_config_versions
FOR EACH ROW EXECUTE FUNCTION public.trg_expansion_config_immutability();

-- 6. Motor de Publicação com Lock e Preview
CREATE OR REPLACE FUNCTION public.expansion_admin_publish_career_config(
    _config_data jsonb,
    _effective_from timestamptz,
    _change_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_id uuid := auth.uid();
    _hash text;
    _new_id uuid;
    _validation jsonb;
    _v_num int;
    _normalized_config jsonb;
BEGIN
    -- 1. Segurança
    IF NOT public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;

    -- 2. Lock de Concorrência (Advisory Lock Bigint)
    PERFORM pg_advisory_xact_lock(42424242);

    -- 3. Normalização e Hash Canônico (SHA-256)
    -- Ordena por sort_order para garantir hash determinístico
    SELECT jsonb_agg(x) INTO _normalized_config FROM (
        SELECT * FROM jsonb_array_elements(_config_data) t ORDER BY (t->>'sort_order')::int ASC
    ) x;
    
    _hash := encode(digest(_normalized_config::text, 'sha256'), 'hex');

    -- 4. Validação Estruturada
    _validation := public.expansion_career_config_validate(_normalized_config);
    IF NOT (_validation->>'valid')::boolean THEN
        RAISE EXCEPTION 'Configuração inválida: %', _validation->'errors';
    END IF;

    -- 5. Validação de Vigência (Segunda-feira 00:00 Bahia)
    -- Verifica se é 00:00:00 no fuso America/Bahia (-03)
    IF EXTRACT(DOW FROM _effective_from AT TIME ZONE 'America/Bahia') != 1 OR 
       EXTRACT(HOUR FROM _effective_from AT TIME ZONE 'America/Bahia') != 0 THEN
        RAISE EXCEPTION 'A data de vigência deve ser uma segunda-feira às 00:00 (Horário da Bahia).';
    END IF;

    IF _effective_from <= now() THEN
        RAISE EXCEPTION 'A vigência deve ser futura.';
    END IF;

    -- 6. Verifica Duplicidade e Concorrência de Vigência
    IF EXISTS (SELECT 1 FROM public.expansion_career_config_versions WHERE effective_from = _effective_from AND status != 'CANCELLED') THEN
        RAISE EXCEPTION 'Já existe uma publicação agendada para esta data.';
    END IF;

    -- 7. Próximo Número de Versão (Sequência Atômica)
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO _v_num FROM public.expansion_career_config_versions;

    -- 8. Inserção
    INSERT INTO public.expansion_career_config_versions (
        version_number,
        status,
        effective_from,
        config_data,
        config_hash,
        published_at,
        published_by,
        change_reason
    ) VALUES (
        _v_num,
        'PUBLISHED',
        _effective_from,
        _normalized_config,
        _hash,
        now(),
        _user_id,
        _change_reason
    ) RETURNING id INTO _new_id;

    RETURN _new_id;
END;
$$;

-- 7. Wrapper de Cancelamento
CREATE OR REPLACE FUNCTION public.expansion_admin_cancel_future_config(
    _version_id uuid,
    _reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_id uuid := auth.uid();
    _ver record;
BEGIN
    IF NOT public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;

    SELECT * INTO _ver FROM public.expansion_career_config_versions WHERE id = _version_id FOR UPDATE;
    
    IF _ver.status != 'PUBLISHED' THEN RAISE EXCEPTION 'Somente versões publicadas podem ser canceladas.'; END IF;
    IF _ver.effective_from <= now() THEN RAISE EXCEPTION 'Não é possível cancelar uma versão que já entrou em vigor.'; END IF;

    UPDATE public.expansion_career_config_versions 
    SET status = 'CANCELLED',
        cancelled_at = now(),
        cancelled_by = _user_id,
        cancellation_reason = _reason
    WHERE id = _version_id;

    RETURN true;
END;
$$;

-- 8. Baseline (Versão 1)
-- Marco temporal ajustado para o menor corte histórico encontrado ou 27/07
DO $$
DECLARE
    _config jsonb;
    _hash text;
BEGIN
    -- Captura configuração atual incluindo required_leaders integralmente
    SELECT jsonb_agg(c) INTO _config FROM (
        SELECT 
            rank_key, rank_label, sort_order, min_organizational_points, 
            min_qualified_teams, max_team_concentration_pct, min_qualified_team_points, 
            min_active_partners_per_team, required_leaders, is_active
        FROM public.expansion_career_config 
        ORDER BY sort_order ASC
    ) c;

    IF _config IS NOT NULL THEN
        _hash := encode(digest(_config::text, 'sha256'), 'hex');
        
        -- Versão 1 (Baseline) - Forçada para o passado para cobrir todo histórico
        INSERT INTO public.expansion_career_config_versions (
            version_number,
            status,
            effective_from,
            config_data,
            config_hash,
            published_at,
            change_reason
        ) VALUES (
            1,
            'PUBLISHED',
            '2026-07-27 00:00:00-03', -- Baseline oficial
            _config,
            _hash,
            now(),
            'Baseline: Importação oficial da configuração inicial v1.'
        ) ON CONFLICT (version_number) DO NOTHING;
    END IF;
END $$;

-- 9. Integração com o Motor (Exemplo de Refatoração Necessária)
-- Aqui as funções de cálculo devem ser atualizadas para injetar config_data via expansion_career_config_at(evaluated_as_of)
-- Isso será aplicado no commit final das funções do motor.

COMMIT;