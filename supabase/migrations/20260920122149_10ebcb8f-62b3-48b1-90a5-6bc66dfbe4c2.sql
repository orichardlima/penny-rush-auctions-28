CREATE TABLE public.partner_revenue_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  weekly_percentage numeric NOT NULL CHECK (weekly_percentage >= 0 AND weekly_percentage <= 100),
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_revenue_overrides TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_revenue_overrides TO authenticated;
GRANT ALL ON public.partner_revenue_overrides TO service_role;

ALTER TABLE public.partner_revenue_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage revenue overrides"
ON public.partner_revenue_overrides FOR ALL TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Partners view own revenue override"
ON public.partner_revenue_overrides FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_partner_revenue_overrides_updated_at
BEFORE UPDATE ON public.partner_revenue_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.partner_revenue_override_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  old_percentage numeric,
  new_percentage numeric,
  old_is_active boolean,
  new_is_active boolean,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.partner_revenue_override_audit TO authenticated;
GRANT ALL ON public.partner_revenue_override_audit TO service_role;

ALTER TABLE public.partner_revenue_override_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view revenue override audit"
ON public.partner_revenue_override_audit FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_partner_revenue_override_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.partner_revenue_override_audit (user_id, action, new_percentage, new_is_active, note, changed_by)
    VALUES (NEW.user_id, 'CREATE', NEW.weekly_percentage, NEW.is_active, NEW.note, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.partner_revenue_override_audit (user_id, action, old_percentage, new_percentage, old_is_active, new_is_active, note, changed_by)
    VALUES (NEW.user_id, 'UPDATE', OLD.weekly_percentage, NEW.weekly_percentage, OLD.is_active, NEW.is_active, NEW.note, auth.uid());
    RETURN NEW;
  ELSE
    INSERT INTO public.partner_revenue_override_audit (user_id, action, old_percentage, old_is_active, note, changed_by)
    VALUES (OLD.user_id, 'DELETE', OLD.weekly_percentage, OLD.is_active, OLD.note, auth.uid());
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_partner_revenue_overrides_audit
AFTER INSERT OR UPDATE OR DELETE ON public.partner_revenue_overrides
FOR EACH ROW EXECUTE FUNCTION public.log_partner_revenue_override_change();

CREATE INDEX idx_partner_revenue_overrides_active ON public.partner_revenue_overrides (user_id) WHERE is_active;