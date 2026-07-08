
-- Etapa 4B: Performance tracking flag + signup attribution trigger

-- 1. Seed flag (idempotente)
INSERT INTO public.performance_settings (setting_key, setting_value)
VALUES ('performance_tracking_enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Função de atribuição de signup (separada, não altera handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user_performance_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled text;
  v_visitor_id text;
  v_ref_code text;
BEGIN
  BEGIN
    SELECT setting_value INTO v_enabled
    FROM public.performance_settings
    WHERE setting_key = 'performance_tracking_enabled';

    IF v_enabled IS DISTINCT FROM 'true' THEN
      RETURN NEW;
    END IF;

    v_visitor_id := NEW.raw_user_meta_data->>'perf_visitor_id';
    v_ref_code   := NEW.raw_user_meta_data->>'perf_ref_code';

    IF v_visitor_id IS NULL OR length(v_visitor_id) = 0 THEN
      RETURN NEW;
    END IF;

    PERFORM public.attribute_conversion(
      'signup',
      NEW.id::text,
      NEW.id,
      v_visitor_id,
      jsonb_build_object(
        'perf_ref_code', v_ref_code,
        'source', 'auth_signup'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.performance_audit_logs(action, error_message, metadata)
      VALUES (
        'signup_attribution_error',
        SQLERRM,
        jsonb_build_object('user_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$$;

-- 3. Trigger separado (não interfere com trigger existente do handle_new_user)
DROP TRIGGER IF EXISTS on_auth_user_created_performance ON auth.users;

CREATE TRIGGER on_auth_user_created_performance
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_performance_attribution();

-- 4. Segurança da função trigger
REVOKE ALL ON FUNCTION public.handle_new_user_performance_attribution()
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_performance_attribution()
FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user_performance_attribution()
FROM authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user_performance_attribution()
TO service_role;
