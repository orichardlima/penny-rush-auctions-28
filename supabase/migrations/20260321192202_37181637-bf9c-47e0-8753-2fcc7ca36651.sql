
-- Função que credita lances bônus automaticamente quando contrato é criado
CREATE OR REPLACE FUNCTION credit_partner_bonus_bids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' 
     AND COALESCE(NEW.bonus_bids_received, 0) > 0 
     AND NEW.is_demo = false THEN
    
    -- Usar flag de sessão para contornar o trigger de proteção
    PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
    
    UPDATE profiles
    SET bids_balance = bids_balance + NEW.bonus_bids_received,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger no INSERT de partner_contracts
CREATE TRIGGER trg_credit_bonus_bids_on_contract
AFTER INSERT ON partner_contracts
FOR EACH ROW
EXECUTE FUNCTION credit_partner_bonus_bids();

-- Corrigir caso pendente: Tiago Vieira (1200 lances do plano Legend)
DO $$
BEGIN
  PERFORM set_config('app.allow_sensitive_profile_update', 'true', true);
  UPDATE profiles
  SET bids_balance = bids_balance + 1200,
      updated_at = now()
  WHERE user_id = 'fadb0e25-821c-4dd5-bb48-32d25efbec14'
    AND bids_balance = 0;
END;
$$;
