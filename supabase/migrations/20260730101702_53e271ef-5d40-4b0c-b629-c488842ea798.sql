
CREATE OR REPLACE FUNCTION public.scan_withdrawal_integrity()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD; v_bad int := 0; v_total int := 0;
BEGIN
  FOR r IN SELECT id FROM public.partner_withdrawals
            WHERE withdrawal_flow_version = 'v2'
              AND status IN ('PENDING','APPROVED','PROCESSING','PAID')
  LOOP
    v_total := v_total + 1;
    IF NOT public.validate_withdrawal_composition(r.id, false) THEN
      v_bad := v_bad + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('checked', v_total, 'inconsistent', v_bad, 'scanned_at', now());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.scan_withdrawal_integrity() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_withdrawal_integrity() TO service_role;

SELECT cron.unschedule('scan-withdrawal-integrity')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='scan-withdrawal-integrity');
SELECT cron.schedule('scan-withdrawal-integrity', '7 * * * *',
  $$SELECT public.scan_withdrawal_integrity();$$);
