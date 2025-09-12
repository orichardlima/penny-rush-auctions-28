-- Create system_settings table for admin configurations
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin-only access
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (is_admin_user(auth.uid()));

-- Insert default signup bonus setting
INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
VALUES 
  ('signup_bonus_bids', '5', 'number', 'Quantidade de lances gratuitos para novos usuários'),
  ('signup_bonus_enabled', 'true', 'boolean', 'Ativar/desativar bônus de cadastro');

-- Create audit log table for system setting changes
CREATE TABLE public.system_settings_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for audit table
ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;

-- Policy for audit log (admin read-only)
CREATE POLICY "Admins can view settings audit log" 
ON public.system_settings_audit 
FOR SELECT 
USING (is_admin_user(auth.uid()));

-- Function to log setting changes
CREATE OR REPLACE FUNCTION public.log_setting_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.system_settings_audit (setting_key, old_value, new_value, changed_by)
  VALUES (NEW.setting_key, OLD.setting_value, NEW.setting_value, auth.uid());
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for audit logging
CREATE TRIGGER system_settings_audit_trigger
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_setting_change();

-- Update handle_new_user function to include signup bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  bonus_enabled boolean := false;
  bonus_amount integer := 0;
BEGIN
  -- Get signup bonus settings
  SELECT (setting_value::boolean) INTO bonus_enabled 
  FROM public.system_settings 
  WHERE setting_key = 'signup_bonus_enabled';
  
  SELECT (setting_value::integer) INTO bonus_amount 
  FROM public.system_settings 
  WHERE setting_key = 'signup_bonus_bids';
  
  -- Create user profile
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    email,
    cpf,
    phone,
    birth_date,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    bids_balance
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'cpf',
    NEW.raw_user_meta_data ->> 'phone',
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE 
      ELSE NULL 
    END,
    NEW.raw_user_meta_data ->> 'cep',
    NEW.raw_user_meta_data ->> 'street',
    NEW.raw_user_meta_data ->> 'number',
    NEW.raw_user_meta_data ->> 'complement',
    NEW.raw_user_meta_data ->> 'neighborhood',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'state',
    CASE 
      WHEN COALESCE(bonus_enabled, false) = true THEN COALESCE(bonus_amount, 0)
      ELSE 0
    END
  );
  
  -- Log signup bonus if granted
  IF COALESCE(bonus_enabled, false) = true AND COALESCE(bonus_amount, 0) > 0 THEN
    RAISE LOG 'Signup bonus granted: % bids for user %', bonus_amount, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;