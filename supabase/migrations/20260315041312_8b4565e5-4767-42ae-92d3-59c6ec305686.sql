
DROP FUNCTION IF EXISTS public.get_referred_contracts_info(uuid[]);

CREATE OR REPLACE FUNCTION public.get_referred_contracts_info(contract_ids uuid[])
RETURNS TABLE(id uuid, plan_name text, user_id uuid, referred_by_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.plan_name, c.user_id, c.referred_by_user_id
  FROM public.partner_contracts c
  WHERE c.id = ANY(contract_ids);
$$;
