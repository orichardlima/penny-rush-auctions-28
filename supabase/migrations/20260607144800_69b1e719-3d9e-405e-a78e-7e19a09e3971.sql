CREATE OR REPLACE FUNCTION public.trigger_propagate_upgrade_binary_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_cotas INT;
  v_is_demo BOOLEAN;
  v_old_pts INT;
  v_new_pts INT;
  v_new_plan_aporte NUMERIC;
  v_new_cotas INT;
  v_delta INT := 0;
BEGIN
  -- Buscar cotas atuais do contrato (ainda não atualizadas neste ponto)
  SELECT cotas, is_demo INTO v_contract_cotas, v_is_demo
  FROM partner_contracts WHERE id = NEW.partner_contract_id;

  IF v_is_demo IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.previous_plan_name = NEW.new_plan_name THEN
    -- Upgrade de COTAS: mesmo plano, mais cotas
    SELECT binary_points, aporte_value INTO v_new_pts, v_new_plan_aporte
    FROM partner_plans WHERE name = NEW.new_plan_name AND is_active = true
    LIMIT 1;

    IF v_new_plan_aporte IS NULL OR v_new_plan_aporte = 0 THEN
      RAISE NOTICE '[upgrade-binary-trigger] Plan aporte invalid for %, skipping', NEW.new_plan_name;
      RETURN NEW;
    END IF;

    v_new_cotas := ROUND(NEW.new_aporte_value / v_new_plan_aporte);
    v_delta := COALESCE(v_new_pts, 0) * (v_new_cotas - v_contract_cotas);
  ELSE
    -- Upgrade de PLANO
    SELECT binary_points INTO v_old_pts
    FROM partner_plans WHERE name = NEW.previous_plan_name LIMIT 1;
    SELECT binary_points INTO v_new_pts
    FROM partner_plans WHERE name = NEW.new_plan_name LIMIT 1;

    v_delta := (COALESCE(v_new_pts, 0) - COALESCE(v_old_pts, 0)) * COALESCE(v_contract_cotas, 1);
  END IF;

  IF v_delta > 0 THEN
    PERFORM public.propagate_binary_points(NEW.partner_contract_id, v_delta, 'plan_upgrade');
    RAISE NOTICE '[upgrade-binary-trigger] Propagated % points for contract %', v_delta, NEW.partner_contract_id;
  ELSE
    RAISE NOTICE '[upgrade-binary-trigger] Delta=% for contract %, no propagation', v_delta, NEW.partner_contract_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upgrade_propagate_binary ON public.partner_upgrades;
CREATE TRIGGER trg_upgrade_propagate_binary
AFTER INSERT ON public.partner_upgrades
FOR EACH ROW
EXECUTE FUNCTION public.trigger_propagate_upgrade_binary_points();