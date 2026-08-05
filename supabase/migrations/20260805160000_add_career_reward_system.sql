-- ======================================================================================
-- MIGRATION: PROGRAMA DE EXPANSÃO - CATÁLOGO E DIREITO A PREMIAÇÕES DE CARREIRA
-- ======================================================================================

BEGIN;

-- 1. Enum para Status do Catálogo e Status da Premiação
DO $$ BEGIN
    CREATE TYPE public.expansion_reward_catalog_status AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.expansion_reward_entitlement_status AS ENUM ('PENDING_REVIEW', 'APPROVED', 'IN_FULFILLMENT', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tabela de Catálogo Versionado de Premiações
CREATE TABLE IF NOT EXISTS public.expansion_career_reward_catalog_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number integer NOT NULL,
    status public.expansion_reward_catalog_status NOT NULL DEFAULT 'DRAFT',
    effective_from timestamptz NOT NULL,
    rewards_data jsonb NOT NULL,
    config_hash text NOT NULL,
    change_reason text NOT NULL,
    retroactive_policy text DEFAULT 'NONE' CHECK (retroactive_policy IN ('NONE', 'FROM_EFFECTIVE_DATE', 'MANUAL')),
    
    -- Auditoria
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    published_at timestamptz,
    published_by uuid REFERENCES auth.users(id),
    cancelled_at timestamptz,
    cancelled_by uuid REFERENCES auth.users(id),
    cancellation_reason text,
    
    CONSTRAINT uk_expansion_reward_catalog_version UNIQUE(version_number),
    CONSTRAINT ck_expansion_reward_reason CHECK (length(trim(change_reason)) > 0)
);

-- RLS Administrativo
ALTER TABLE public.expansion_career_reward_catalog_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.expansion_career_reward_catalog_versions TO authenticated;
GRANT ALL ON public.expansion_career_reward_catalog_versions TO service_role;

-- 3. Tabela de Direito à Premiação (Entitlements)
CREATE TABLE IF NOT EXISTS public.expansion_career_reward_entitlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    rank_key text NOT NULL,
    rank_evaluation_id uuid REFERENCES public.expansion_rank_evaluations(id),
    earned_at timestamptz DEFAULT now(),
    evaluated_as_of timestamptz NOT NULL,
    reward_catalog_version_id uuid REFERENCES public.expansion_career_reward_catalog_versions(id),
    reward_snapshot jsonb NOT NULL,
    status public.expansion_reward_entitlement_status NOT NULL DEFAULT 'PENDING_REVIEW',
    
    -- Auditoria de Entrega
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    approved_by uuid REFERENCES auth.users(id),
    fulfillment_started_at timestamptz,
    delivered_at timestamptz,
    cancelled_at timestamptz,
    cancellation_reason text,
    
    internal_notes text,
    partner_visible_notes text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Unicidade: Um prêmio por rank por usuário
    CONSTRAINT uk_user_rank_reward UNIQUE(user_id, rank_key)
);

-- RLS Entitlements
ALTER TABLE public.expansion_career_reward_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own rewards"
    ON public.expansion_career_reward_entitlements
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

GRANT SELECT ON public.expansion_career_reward_entitlements TO authenticated;
GRANT ALL ON public.expansion_career_reward_entitlements TO service_role;

-- 4. Função de Validação do JSON de Premiações
CREATE OR REPLACE FUNCTION public.expansion_career_reward_catalog_validate(_rewards jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    _errors text[] := '{}';
    _item jsonb;
    _ranks text[] := '{}';
    _count int := 0;
    _canonical_ranks text[] := ARRAY['BRONZE', 'PRATA', 'OURO', 'PLATINA', 'DIAMANTE'];
    _allowed_types text[] := ARRAY['PRODUCT', 'TRAVEL', 'EXPERIENCE', 'CASH', 'RECOGNITION', 'EVENT', 'CUSTOM'];
BEGIN
    IF jsonb_typeof(_rewards) <> 'array' THEN 
        RETURN jsonb_build_object('valid', false, 'errors', ARRAY['rewards_data deve ser um array']);
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(_rewards) LOOP
        _count := _count + 1;
        
        -- Campos obrigatórios
        IF NOT (_item ? 'rank_key' AND _item ? 'reward_title' AND _item ? 'reward_type') THEN
            _errors := array_append(_errors, format('Item %s omitiu campos obrigatórios', _count));
            CONTINUE;
        END IF;

        -- Rank Canônico
        IF NOT (_item->>'rank_key' = ANY(_canonical_ranks)) THEN
            _errors := array_append(_errors, format('Rank não canônico: %s', _item->>'rank_key'));
        END IF;

        -- Unicidade de Rank no Catálogo
        IF _item->>'rank_key' = ANY(_ranks) THEN
            _errors := array_append(_errors, format('Rank duplicado no catálogo: %s', _item->>'rank_key'));
        END IF;
        _ranks := array_append(_ranks, _item->>'rank_key');

        -- Tipo de Premiação
        IF NOT (_item->>'reward_type' = ANY(_allowed_types)) THEN
            _errors := array_append(_errors, format('Tipo de recompensa inválido: %s', _item->>'reward_type'));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'valid', array_length(_errors, 1) IS NULL,
        'errors', _errors
    );
END;
$$;

-- 5. Função para buscar catálogo vigente
CREATE OR REPLACE FUNCTION public.expansion_career_reward_catalog_at(_as_of timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _catalog record;
BEGIN
    SELECT * INTO _catalog
    FROM public.expansion_career_reward_catalog_versions
    WHERE effective_from <= _as_of
      AND status = 'PUBLISHED'
    ORDER BY effective_from DESC, version_number DESC
    LIMIT 1;

    IF _catalog.id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN to_jsonb(_catalog);
END;
$$;

-- 6. Função para Gerar Entitlements por Promoção (Idempotente)
CREATE OR REPLACE FUNCTION public.expansion_create_career_reward_entitlements_for_promotion(
    _user_id uuid,
    _new_rank text,
    _evaluated_as_of timestamptz,
    _rank_evaluation_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _catalog_record jsonb;
    _reward_item jsonb;
    _canonical_ranks text[] := ARRAY['BRONZE', 'PRATA', 'OURO', 'PLATINA', 'DIAMANTE'];
    _rank text;
    _created_count int := 0;
    _skip boolean := true;
BEGIN
    -- Busca catálogo vigente no momento da avaliação
    _catalog_record := public.expansion_career_reward_catalog_at(_evaluated_as_of);
    IF _catalog_record IS NULL THEN RETURN 0; END IF;

    -- Itera sobre ranks canônicos para premiar saltos (ex: NONE -> OURO premia BRONZE e PRATA também)
    FOREACH _rank IN ARRAY _canonical_ranks LOOP
        -- Só começa a processar a partir de BRONZE até o novo rank
        _skip := false; -- Aqui na verdade a lógica deve ser: se o rank atual for <= ao _new_rank
        
        -- Verifica se o rank iterado é menor ou igual ao alcançado
        IF public.expansion_rank_is_higher(_rank, _new_rank) THEN
            EXIT; -- Chegou acima do rank atual
        END IF;

        -- Se já possui entitlement para este rank, pula
        IF EXISTS (SELECT 1 FROM public.expansion_career_reward_entitlements WHERE user_id = _user_id AND rank_key = _rank) THEN
            CONTINUE;
        END IF;

        -- Busca a configuração deste rank no catálogo
        SELECT item INTO _reward_item 
        FROM jsonb_array_elements(_catalog_record->'rewards_data') item 
        WHERE item->>'rank_key' = _rank AND (item->>'is_active')::boolean = true;

        IF _reward_item IS NOT NULL THEN
            INSERT INTO public.expansion_career_reward_entitlements (
                user_id, rank_key, rank_evaluation_id, evaluated_as_of, 
                reward_catalog_version_id, reward_snapshot, status
            ) VALUES (
                _user_id, _rank, _rank_evaluation_id, _evaluated_as_of,
                (_catalog_record->>'id')::uuid, _reward_item, 'PENDING_REVIEW'
            );
            _created_count := _created_count + 1;
        END IF;
    END LOOP;

    RETURN _created_count;
END;
$$;

-- 7. Trigger para processar premiações após avaliação de carreira
CREATE OR REPLACE FUNCTION public.trg_expansion_process_rewards_after_evaluation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Só processa se for PROMOTED ou se o rank final for maior que NONE (primeira graduação)
    IF NEW.status = 'COMPLETED' AND NEW.rank_key != 'NONE' THEN
        PERFORM public.expansion_create_career_reward_entitlements_for_promotion(
            NEW.user_id, 
            NEW.rank_key, 
            NEW.evaluated_as_of, 
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expansion_reward_generation
AFTER INSERT OR UPDATE ON public.expansion_rank_evaluations
FOR EACH ROW EXECUTE FUNCTION public.trg_expansion_process_rewards_after_evaluation();

-- 8. RPC Administrativo para Publicar Catálogo
CREATE OR REPLACE FUNCTION public.expansion_admin_publish_reward_catalog(
    _rewards_data jsonb,
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
    _v_num int;
    _validation jsonb;
BEGIN
    IF NOT public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;

    -- Validação
    _validation := public.expansion_career_reward_catalog_validate(_rewards_data);
    IF NOT (_validation->>'valid')::boolean THEN
        RAISE EXCEPTION 'Dados do catálogo inválidos: %', _validation->'errors';
    END IF;

    -- Hash
    _hash := encode(digest(_rewards_data::text, 'sha256'), 'hex');

    -- Versão
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO _v_num FROM public.expansion_career_reward_catalog_versions;

    INSERT INTO public.expansion_career_reward_catalog_versions (
        version_number, status, effective_from, rewards_data, config_hash,
        published_at, published_by, change_reason, created_by
    ) VALUES (
        _v_num, 'PUBLISHED', _effective_from, _rewards_data, _hash,
        now(), _user_id, _change_reason, _user_id
    ) RETURNING id INTO _new_id;

    RETURN _new_id;
END;
$$;

-- 9. Seed Inicial (V1)
DO $$
DECLARE
    _rewards jsonb;
BEGIN
    _rewards := '[
        {
            "rank_key": "BRONZE",
            "reward_title": "Kit Bronze Show",
            "reward_description": "Camiseta exclusiva e adesivo oficial Show de Lances.",
            "reward_type": "PRODUCT",
            "display_value": 50,
            "currency": "BRL",
            "image_url": "https://id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app/placeholder.svg",
            "icon": "Package",
            "short_highlight": "Kit Boas-vindas",
            "terms": "Entrega em até 30 dias úteis.",
            "delivery_estimate_days": 30,
            "requires_manual_approval": true,
            "is_active": true
        },
        {
            "rank_key": "PRATA",
            "reward_title": "Fone Bluetooth Premium",
            "reward_description": "Fone de ouvido de alta qualidade para suas reuniões.",
            "reward_type": "PRODUCT",
            "display_value": 250,
            "currency": "BRL",
            "image_url": "https://id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app/placeholder.svg",
            "icon": "Headphones",
            "short_highlight": "Áudio de Elite",
            "terms": "Entrega via transportadora.",
            "delivery_estimate_days": 30,
            "requires_manual_approval": true,
            "is_active": true
        },
        {
            "rank_key": "OURO",
            "reward_title": "Viagem de Reconhecimento",
            "reward_description": "Final de semana com acompanhante em resort parceiro.",
            "reward_type": "TRAVEL",
            "display_value": 2000,
            "currency": "BRL",
            "image_url": "https://id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app/placeholder.svg",
            "icon": "Palmtree",
            "short_highlight": "Experiência Inesquecível",
            "terms": "Agendamento sujeito a disponibilidade.",
            "delivery_estimate_days": 60,
            "requires_manual_approval": true,
            "is_active": true
        },
        {
            "rank_key": "PLATINA",
            "reward_title": "iPhone de Última Geração",
            "reward_description": "A ferramenta definitiva para o líder de expansão.",
            "reward_type": "PRODUCT",
            "display_value": 8000,
            "currency": "BRL",
            "image_url": "https://id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app/placeholder.svg",
            "icon": "Smartphone",
            "short_highlight": "Tecnologia de Ponta",
            "terms": "Modelo base do ano vigente.",
            "delivery_estimate_days": 45,
            "requires_manual_approval": true,
            "is_active": true
        },
        {
            "rank_key": "DIAMANTE",
            "reward_title": "Carro 0km Show",
            "reward_description": "O símbolo máximo do seu sucesso no Programa de Expansão.",
            "reward_type": "PRODUCT",
            "display_value": 80000,
            "currency": "BRL",
            "image_url": "https://id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app/placeholder.svg",
            "icon": "Car",
            "short_highlight": "Liberdade e Conquista",
            "terms": "Consulte regulamento de entrega de veículos.",
            "delivery_estimate_days": 90,
            "requires_manual_approval": true,
            "is_active": true
        }
    ]'::jsonb;

    IF NOT EXISTS (SELECT 1 FROM public.expansion_career_reward_catalog_versions WHERE version_number = 1) THEN
        INSERT INTO public.expansion_career_reward_catalog_versions (
            version_number, status, effective_from, rewards_data, config_hash,
            published_at, change_reason
        ) VALUES (
            1, 'PUBLISHED', '2026-07-27 00:00:00-03', _rewards, 
            encode(digest(_rewards::text, 'sha256'), 'hex'),
            now(), 'Baseline Inicial de Premiações V1'
        );
    END IF;
END $$;

COMMIT;
