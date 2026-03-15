-- Fix critical: Split the ALL policy to prevent privilege escalation
-- The ALL policy with USING (auth.uid() = user_id OR is_admin_user()) 
-- allows non-admins to UPDATE their own row and set is_admin=true
-- because permissive policies are OR'd

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Admin SELECT - can view all profiles
CREATE POLICY "Admins can select all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Admin INSERT - can insert profiles  
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user(auth.uid()));

-- Admin UPDATE - can update any profile
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- Admin DELETE - can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Also restrict binary_cycle_closures to authenticated
DROP POLICY IF EXISTS "Anyone can view binary cycles" ON public.binary_cycle_closures;
CREATE POLICY "Authenticated can view binary cycles"
  ON public.binary_cycle_closures FOR SELECT
  TO authenticated
  USING (true);