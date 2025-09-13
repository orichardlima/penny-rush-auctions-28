-- Add user blocking and audit functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS blocked_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS block_reason text;

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  admin_name text NOT NULL,
  action_type text NOT NULL, -- 'user_blocked', 'user_unblocked', 'user_deleted', 'balance_updated', etc
  target_type text NOT NULL, -- 'user', 'auction', etc
  target_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  description text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit log
CREATE POLICY "Admins can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (is_admin_user(auth.uid()));

-- Update profiles RLS to block access for blocked users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id AND COALESCE(is_blocked, false) = false);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id AND COALESCE(is_blocked, false) = false);

-- Block bid creation for blocked users
DROP POLICY IF EXISTS "Users can insert their own bids" ON public.bids;
CREATE POLICY "Users can insert their own bids" 
ON public.bids 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND COALESCE(is_blocked, false) = true
  )
);

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_target_type text, 
  p_target_id uuid,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_description text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_profile RECORD;
BEGIN
  -- Get admin profile info
  SELECT user_id, full_name INTO admin_profile
  FROM public.profiles 
  WHERE user_id = auth.uid() AND is_admin = true;
  
  IF admin_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can log actions';
  END IF;
  
  -- Insert audit log
  INSERT INTO public.admin_audit_log (
    admin_user_id,
    admin_name,
    action_type,
    target_type,
    target_id,
    old_values,
    new_values,
    description
  ) VALUES (
    admin_profile.user_id,
    COALESCE(admin_profile.full_name, 'Admin'),
    p_action_type,
    p_target_type,
    p_target_id,
    p_old_values,
    p_new_values,
    p_description
  );
END;
$$;