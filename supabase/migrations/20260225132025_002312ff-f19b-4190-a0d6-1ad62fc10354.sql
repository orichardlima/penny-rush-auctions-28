
CREATE OR REPLACE FUNCTION public.validate_fury_vault_withdrawal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_blocked boolean;
  v_cpf text;
  v_duplicate_count integer;
  v_last_withdrawal_at timestamptz;
  v_cooldown_days integer;
  v_min_amount numeric;
  v_max_monthly_pct numeric;
  v_total_won numeric;
  v_total_withdrawn_this_month numeric;
  v_config fury_vault_config%ROWTYPE;
BEGIN
  SELECT COALESCE(is_blocked, false), cpf
  INTO v_is_blocked, v_cpf
  FROM profiles WHERE user_id = NEW.user_id;

  IF v_is_blocked THEN
    RAISE EXCEPTION 'Conta bloqueada. Entre em contato com o suporte.';
  END IF;

  IF v_cpf IS NULL OR TRIM(v_cpf) = '' THEN
    RAISE EXCEPTION 'CPF obrigatório. Complete seu cadastro antes de solicitar saques.';
  END IF;

  SELECT COUNT(*) INTO v_duplicate_count
  FROM fury_vault_withdrawals w
  JOIN profiles p ON p.user_id = w.user_id
  WHERE p.cpf = v_cpf AND w.user_id != NEW.user_id
    AND w.status IN ('pending', 'processing', 'completed');

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'CPF já utilizado em saques de outra conta.';
  END IF;

  SELECT * INTO v_config FROM fury_vault_config WHERE is_active = true LIMIT 1;

  IF v_config.id IS NOT NULL THEN
    v_cooldown_days := v_config.withdrawal_cooldown_days;
    v_min_amount := v_config.min_withdrawal_amount;
    v_max_monthly_pct := v_config.max_monthly_withdrawal_pct;
  ELSE
    v_cooldown_days := 30;
    v_min_amount := 100;
    v_max_monthly_pct := 50;
  END IF;

  IF NEW.amount < v_min_amount THEN
    RAISE EXCEPTION 'Saque mínimo é R$ %. Valor solicitado: R$ %', v_min_amount, NEW.amount;
  END IF;

  SELECT MAX(created_at) INTO v_last_withdrawal_at
  FROM fury_vault_withdrawals
  WHERE user_id = NEW.user_id AND status NOT IN ('rejected', 'cancelled');

  IF v_last_withdrawal_at IS NOT NULL AND
     v_last_withdrawal_at > (now() - (v_cooldown_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Aguarde % dias entre solicitações de saque.', v_cooldown_days;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawn_this_month
  FROM fury_vault_withdrawals
  WHERE user_id = NEW.user_id
    AND status NOT IN ('rejected', 'cancelled')
    AND created_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(fvl.amount), 0) INTO v_total_won
  FROM fury_vault_logs fvl
  JOIN fury_vault_instances fvi ON fvi.id = fvl.vault_instance_id
  WHERE fvl.event_type IN ('distribution_top', 'distribution_raffle')
    AND (fvl.details->>'user_id')::uuid = NEW.user_id;

  IF v_total_won > 0 AND
     ((v_total_withdrawn_this_month + NEW.amount) / v_total_won * 100) > v_max_monthly_pct THEN
    RAISE EXCEPTION 'Limite mensal de saque atingido (máximo permitido: %).',
      v_max_monthly_pct || '%';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_fury_vault_withdrawal_trigger ON fury_vault_withdrawals;
CREATE TRIGGER validate_fury_vault_withdrawal_trigger
  BEFORE INSERT ON fury_vault_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION validate_fury_vault_withdrawal();
