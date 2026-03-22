CREATE OR REPLACE FUNCTION get_affiliate_purchase_details(
  _affiliate_id uuid,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  purchase_amount numeric,
  commission_amount numeric,
  commission_rate numeric,
  is_repurchase boolean,
  status text,
  referred_user_name text,
  package_name text,
  bids_purchased integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  SELECT a.user_id INTO _owner_id
  FROM affiliates a WHERE a.id = _affiliate_id;
  
  IF _owner_id IS NULL OR _owner_id != auth.uid() THEN
    IF NOT is_admin_user(auth.uid()) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    ac.id,
    ac.created_at,
    ac.purchase_amount,
    ac.commission_amount,
    ac.commission_rate,
    ac.is_repurchase,
    ac.status,
    COALESCE(p.full_name, 'Usuário')::text AS referred_user_name,
    COALESCE(bp2.name, 'Pacote')::text AS package_name,
    COALESCE(bpur.bids_purchased, 0)::integer AS bids_purchased,
    COUNT(*) OVER() AS total_count
  FROM affiliate_commissions ac
  LEFT JOIN profiles p ON p.user_id = ac.referred_user_id
  LEFT JOIN bid_purchases bpur ON bpur.id = ac.purchase_id
  LEFT JOIN bid_packages bp2 ON bp2.id = bpur.package_id
  WHERE ac.affiliate_id = _affiliate_id
  ORDER BY ac.created_at DESC
  LIMIT _page_size
  OFFSET (_page - 1) * _page_size;
END;
$$