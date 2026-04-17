-- =====================================================
-- ENTREGA 3: Auditoria e Validações da Hierarquia
-- =====================================================

-- 1. Função de validação para affiliate_managers
CREATE OR REPLACE FUNCTION public.validate_affiliate_manager_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager_role text;
  v_manager_status text;
BEGIN
  -- Bloquear auto-recrutamento
  IF NEW.manager_affiliate_id = NEW.influencer_affiliate_id THEN
    RAISE EXCEPTION 'Um afiliado não pode recrutar a si mesmo'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validar override entre 0 e 10
  IF NEW.override_rate < 0 OR NEW.override_rate > 10 THEN
    RAISE EXCEPTION 'A taxa de override deve estar entre 0 e 10 (recebido: %)', NEW.override_rate
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validar que o manager existe, é manager e está ativo
  SELECT role, status INTO v_manager_role, v_manager_status
  FROM public.affiliates
  WHERE id = NEW.manager_affiliate_id;

  IF v_manager_role IS NULL THEN
    RAISE EXCEPTION 'Manager não encontrado'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_manager_role != 'manager' THEN
    RAISE EXCEPTION 'Apenas afiliados com papel de Manager podem recrutar (papel atual: %)', v_manager_role
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_manager_status != 'active' THEN
    RAISE EXCEPTION 'Manager precisa estar ativo para recrutar (status atual: %)', v_manager_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_affiliate_manager_link ON public.affiliate_managers;
CREATE TRIGGER trg_validate_affiliate_manager_link
BEFORE INSERT OR UPDATE ON public.affiliate_managers
FOR EACH ROW
EXECUTE FUNCTION public.validate_affiliate_manager_link();

-- 2. Função de auditoria automática
CREATE OR REPLACE FUNCTION public.log_affiliate_manager_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_performer uuid;
  v_old_value jsonb;
  v_new_value jsonb;
BEGIN
  v_performer := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF TG_OP = 'INSERT' THEN
    v_action := 'linked';
    v_new_value := jsonb_build_object(
      'status', NEW.status,
      'override_rate', NEW.override_rate
    );
    v_old_value := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.override_rate IS DISTINCT FROM NEW.override_rate THEN
      v_action := 'override_rate_changed';
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'status_changed';
    ELSE
      RETURN NEW;
    END IF;

    v_old_value := jsonb_build_object(
      'status', OLD.status,
      'override_rate', OLD.override_rate
    );
    v_new_value := jsonb_build_object(
      'status', NEW.status,
      'override_rate', NEW.override_rate
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'unlinked';
    v_old_value := jsonb_build_object(
      'status', OLD.status,
      'override_rate', OLD.override_rate
    );
    v_new_value := NULL;
  END IF;

  INSERT INTO public.affiliate_manager_audit (
    manager_affiliate_id,
    influencer_affiliate_id,
    action_type,
    performed_by,
    old_value,
    new_value,
    notes
  ) VALUES (
    COALESCE(NEW.manager_affiliate_id, OLD.manager_affiliate_id),
    COALESCE(NEW.influencer_affiliate_id, OLD.influencer_affiliate_id),
    v_action,
    v_performer,
    v_old_value,
    v_new_value,
    'Auto-registrado por trigger'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_affiliate_manager_insert ON public.affiliate_managers;
CREATE TRIGGER trg_log_affiliate_manager_insert
AFTER INSERT ON public.affiliate_managers
FOR EACH ROW
EXECUTE FUNCTION public.log_affiliate_manager_change();

DROP TRIGGER IF EXISTS trg_log_affiliate_manager_update ON public.affiliate_managers;
CREATE TRIGGER trg_log_affiliate_manager_update
AFTER UPDATE ON public.affiliate_managers
FOR EACH ROW
EXECUTE FUNCTION public.log_affiliate_manager_change();

DROP TRIGGER IF EXISTS trg_log_affiliate_manager_delete ON public.affiliate_managers;
CREATE TRIGGER trg_log_affiliate_manager_delete
AFTER DELETE ON public.affiliate_managers
FOR EACH ROW
EXECUTE FUNCTION public.log_affiliate_manager_change();