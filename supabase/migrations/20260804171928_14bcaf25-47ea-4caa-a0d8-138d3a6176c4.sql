BEGIN;

-- 1. Advisory lock para evitar concorrência
SELECT pg_advisory_xact_lock(20260804);

-- 2. Verificação do enum
DO $$ 
BEGIN
    IF to_regtype('public.expansion_config_status') IS NULL THEN
        CREATE TYPE public.expansion_config_status AS ENUM (
            'DRAFT',
            'PUBLISHED',
            'SUPERSEDED',
            'CANCELLED'
        );
    END IF;
END $$;

-- 3. Criação da tabela de versões
CREATE TABLE IF NOT EXISTS public.expansion_career_config_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number int NOT NULL,
    status public.expansion_config_status NOT NULL DEFAULT 'DRAFT',
    effective_from timestamptz NOT NULL,
    config_data jsonb NOT NULL,
    config_hash text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    published_at timestamptz,
    published_by uuid REFERENCES auth.users(id),
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES auth.users(id),
    cancellation_reason text,
    change_reason text NOT NULL,
    dry_run_impact_snapshot jsonb,
    CONSTRAINT uk_expansion_config_version UNIQUE(version_number),
    CONSTRAINT ck_expansion_config_reason CHECK (length(trim(change_reason)) > 0)
);

-- 4. Bootstrap da Versão 1 (Baseline)
DO $$
DECLARE
    _config jsonb;
    _hash text;
    _v1_exists boolean;
    _current_status public.expansion_config_status;
    _current_hash text;
    _current_effective timestamptz;
    _current_data jsonb;
    _target_effective timestamptz := '2026-07-27 02:59:59.999+00';
    _missing_ranks text;
BEGIN
    -- Validação rigorosa dos ranks no legado
    WITH required_ranks AS (
        SELECT unnest(ARRAY['BRONZE', 'PRATA', 'OURO', 'PLATINA', 'DIAMANTE']) as r
    ),
    actual_ranks AS (
        SELECT rank_key FROM public.expansion_career_config
    )
    SELECT string_agg(r, ', ') INTO _missing_ranks
    FROM required_ranks
    WHERE r NOT IN (SELECT rank_key FROM actual_ranks);

    IF _missing_ranks IS NOT NULL THEN
        RAISE EXCEPTION 'Ranks ausentes na configuração legado: %', _missing_ranks;
    END IF;

    IF (SELECT count(*) FROM public.expansion_career_config WHERE rank_key IN ('BRONZE', 'PRATA', 'OURO', 'PLATINA', 'DIAMANTE')) != 5 THEN
        RAISE EXCEPTION 'Quantidade de ranks inválida ou duplicatas detectadas.';
    END IF;

    -- Captura JSON canônico
    SELECT jsonb_agg(t.value ORDER BY (t.value->>'sort_order')::int ASC) INTO _config FROM (
        SELECT jsonb_build_object(
            'rank_key', rank_key, 
            'rank_label', rank_label, 
            'sort_order', sort_order,
            'min_organizational_points', min_organizational_points, 
            'min_qualified_teams', min_qualified_teams,
            'max_team_concentration_pct', max_team_concentration_pct, 
            'min_qualified_team_points', min_qualified_team_points,
            'min_active_partners_per_team', min_active_partners_per_team, 
            'required_leaders', COALESCE(required_leaders, '[]'::jsonb),
            'is_active', is_active
        ) as value
        FROM public.expansion_career_config
        WHERE rank_key IN ('BRONZE', 'PRATA', 'OURO', 'PLATINA', 'DIAMANTE')
    ) t;

    _hash := encode(digest(_config::text, 'sha256'), 'hex');

    -- Idempotência com validação de divergência
    SELECT EXISTS (SELECT 1 FROM public.expansion_career_config_versions WHERE version_number = 1) INTO _v1_exists;

    IF _v1_exists THEN
        SELECT status, config_hash, effective_from, config_data 
        INTO _current_status, _current_hash, _current_effective, _current_data
        FROM public.expansion_career_config_versions WHERE version_number = 1;

        IF _current_status = 'PUBLISHED' 
           AND _current_hash = _hash 
           AND _current_effective = _target_effective 
           AND _current_data IS NOT DISTINCT FROM _config THEN
            RAISE NOTICE 'BASELINE_ALREADY_OK';
        ELSE
            RAISE EXCEPTION 'BASELINE_V1_DIVERGENCE';
        END IF;
    ELSE
        INSERT INTO public.expansion_career_config_versions (
            version_number, status, effective_from, config_data, config_hash,
            published_at, change_reason
        ) VALUES (
            1, 'PUBLISHED', _target_effective, _config, _hash,
            now(), 'Baseline Inicial V1 - Migração Versionada Oficial'
        );
    END IF;
END $$;

COMMIT;