-- lovable-cron-fallback-reviewed: Bounded recovery only while pending, at most 288 scheduled checks/day; provider webhook is disabled and clients can close their screens.
CREATE OR REPLACE FUNCTION public.magenpay_refresh_recovery() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ticket uuid; job bigint; publishable text; BEGIN
 PERFORM pg_advisory_xact_lock(59281642);
 UPDATE public.magenpay_charges SET status='review',last_error='Recovery window elapsed; manual verification required' WHERE status='pending' AND retry_until<=now();
 SELECT jobid INTO job FROM cron.job WHERE jobname='magenpay-pending-recovery';
 IF NOT EXISTS(SELECT 1 FROM public.magenpay_charges WHERE status='pending') THEN IF job IS NOT NULL THEN PERFORM cron.unschedule(job); END IF; RETURN; END IF;
 IF job IS NULL THEN PERFORM cron.schedule('magenpay-pending-recovery','*/5 * * * *','SELECT public.magenpay_refresh_recovery();'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.magenpay_charges WHERE status='pending' AND next_retry_at<=now() AND (lease_until IS NULL OR lease_until<now())) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.magenpay_recovery_tickets WHERE used_at IS NULL AND expires_at>now()) THEN RETURN; END IF;
 INSERT INTO public.magenpay_recovery_tickets DEFAULT VALUES RETURNING id INTO ticket;
 publishable:=nullif(current_setting('supabase.anon_key',true),'');
 IF publishable IS NULL THEN RAISE NOTICE 'Using project publishable key fallback for MagenPay recovery'; publishable:='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsY2RpZGtreGlnb2ZkaHhuenpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTY0NzMsImV4cCI6MjA2OTAzMjQ3M30.fzDV-B0p7U5FnbpjpvRH6KI0ldyRPzPXMcuSw3fnv5k'; END IF;
 PERFORM net.http_post(url:='https://tlcdidkkxigofdhxnzzo.supabase.co/functions/v1/magen-recover-payments',headers:=jsonb_build_object('Content-Type','application/json','apikey',publishable),body:=jsonb_build_object('ticket',ticket),timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.magenpay_refresh_recovery() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.magenpay_refresh_recovery() TO service_role;