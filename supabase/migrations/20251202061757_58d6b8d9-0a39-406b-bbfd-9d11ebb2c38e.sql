-- Create function to check affiliate code availability
-- This function runs with elevated privileges to bypass RLS
CREATE OR REPLACE FUNCTION check_affiliate_code_availability(code_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return true if code is available (doesn't exist)
  -- Return false if code is already taken
  RETURN NOT EXISTS (
    SELECT 1 FROM affiliates 
    WHERE affiliate_code = code_to_check
  );
END;
$$;