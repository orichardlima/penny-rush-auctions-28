CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) != 'service_role'
     AND coalesce(current_setting('app.allow_sensitive_profile_update', true), '') != 'true'
     AND NOT is_admin_user(auth.uid())
  THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  RETURN NEW;
END;
$$;