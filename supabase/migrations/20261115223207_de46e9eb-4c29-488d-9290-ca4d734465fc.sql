CREATE OR REPLACE FUNCTION public.magenpay_queue_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN jsonb_build_object(
    'stale_count', (SELECT count(*) FROM public.magenpay_charges WHERE status='pending' AND retry_until>now() AND next_retry_at < now()-interval '10 minutes'),
    'oldest_stale_at', (SELECT min(next_retry_at) FROM public.magenpay_charges WHERE status='pending' AND retry_until>now() AND next_retry_at < now()-interval '10 minutes'),
    'last_processed_at', (SELECT max(processed_at) FROM public.magenpay_charges WHERE status='completed')
  );
END $$;
REVOKE ALL ON FUNCTION public.magenpay_queue_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.magenpay_queue_health() TO authenticated;