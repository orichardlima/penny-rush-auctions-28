CREATE TABLE public.magenpay_charges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tx_id text NOT NULL UNIQUE, external_reference text NOT NULL,
 user_id uuid NOT NULL, amount numeric NOT NULL, payer_cpf text NOT NULL, pix_copy_paste text NOT NULL,
 snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 next_retry_at timestamptz NOT NULL DEFAULT now(), retry_until timestamptz NOT NULL DEFAULT now()+interval '48 hours',
 lease_until timestamptz, last_error text, processed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.magenpay_charges TO authenticated;
GRANT ALL ON public.magenpay_charges TO service_role;
ALTER TABLE public.magenpay_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own MagenPay charges" ON public.magenpay_charges FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE INDEX magenpay_charges_pending ON public.magenpay_charges(next_retry_at) WHERE status='pending';
CREATE TRIGGER magenpay_charges_updated BEFORE UPDATE ON public.magenpay_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE FUNCTION public.magenpay_claim_pending() RETURNS SETOF public.magenpay_charges LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.magenpay_charges SET lease_until=now()+interval '90 seconds', attempts=attempts+1
 WHERE id IN (SELECT id FROM public.magenpay_charges WHERE status='pending' AND next_retry_at<=now() AND retry_until>now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_retry_at FOR UPDATE SKIP LOCKED LIMIT 10)
 RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.magenpay_claim_pending() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.magenpay_claim_pending() TO service_role;

CREATE FUNCTION public.magenpay_apply_paid(p_charge_id uuid,p_tx_id text,p_amount numeric,p_cpf text,p_confirmed_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.magenpay_charges%rowtype; c public.partner_contracts%rowtype; b public.bid_purchases%rowtype;
 i public.partner_payment_intents%rowtype; d public.partner_credit_debts%rowtype; o public.orders%rowtype;
 s jsonb; typ text; entity uuid; plan public.partner_plans%rowtype; previous record; commission record; n numeric; v_confirmation uuid;
BEGIN
 SELECT * INTO q FROM public.magenpay_charges WHERE id=p_charge_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Charge not found'; END IF;
 IF q.tx_id IS DISTINCT FROM p_tx_id OR p_amount IS NULL OR round(p_amount,2)<>round(q.amount,2) OR p_amount<=0 OR p_cpf IS DISTINCT FROM q.payer_cpf THEN RAISE EXCEPTION 'Payment identity, amount or payer mismatch'; END IF;
 IF q.status='completed' THEN RETURN jsonb_build_object('status','paid','already_processed',true); END IF;
 IF q.status<>'pending' THEN RAISE EXCEPTION 'Charge requires review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=q.user_id AND cpf=q.payer_cpf AND NOT coalesce(is_blocked,false) AND profile_complete) THEN RAISE EXCEPTION 'Profile not eligible'; END IF;
 s:=q.snapshot; typ:=s->>'type'; entity:=(s->>'entity_id')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(q.user_id::text,9281));
 SELECT * INTO previous FROM public.payment_confirmations WHERE provider='magenpay' AND (external_transaction_id=q.tx_id OR external_reference=q.id::text) LIMIT 1;
 IF FOUND THEN RAISE EXCEPTION 'Payment already used; review required'; END IF;
 INSERT INTO public.payment_confirmations(provider,external_transaction_id,external_reference,entity_type,amount,raw_payload)
 VALUES('magenpay',q.tx_id,q.id::text,typ,q.amount,jsonb_build_object('charge_id',q.id,'reference',q.external_reference,'source','authenticated_vps_status')) RETURNING id INTO v_confirmation;
 IF typ='bid_purchase' THEN
  SELECT * INTO b FROM public.bid_purchases WHERE id=entity FOR UPDATE;
  IF NOT FOUND OR b.user_id<>q.user_id OR b.payment_id IS DISTINCT FROM q.tx_id OR b.amount_paid<>q.amount OR b.payment_status<>'pending' THEN RAISE EXCEPTION 'Purchase changed or already paid'; END IF;
  UPDATE public.bid_purchases SET payment_status='completed',payment_confirmed_at=p_confirmed_at,webhook_received_at=now(),gateway_event_id=q.tx_id WHERE id=b.id;
  PERFORM public.credit_paid_bid_purchase(b.user_id,b.id,b.bids_purchased,b.amount_paid,'production','magenpay',NULL,q.tx_id,q.tx_id,md5(q.tx_id),b.created_at,p_confirmed_at,now());
  FOR commission IN SELECT * FROM public.affiliate_commissions WHERE purchase_id=b.id AND status='pending' FOR UPDATE LOOP
   UPDATE public.affiliate_commissions SET status='approved',approved_at=now() WHERE id=commission.id;
   UPDATE public.affiliates SET commission_balance=coalesce(commission_balance,0)+commission.commission_amount,total_commission_earned=coalesce(total_commission_earned,0)+commission.commission_amount,total_conversions=coalesce(total_conversions,0)+1 WHERE id=commission.affiliate_id;
  END LOOP;
 ELSIF typ='partner_intent' THEN
  SELECT * INTO i FROM public.partner_payment_intents WHERE id=entity FOR UPDATE;
  IF NOT FOUND OR i.user_id<>q.user_id OR i.payment_id IS DISTINCT FROM q.tx_id OR i.aporte_value<>q.amount OR i.payment_status<>'pending' THEN RAISE EXCEPTION 'Intent changed or already paid'; END IF;
  IF EXISTS(SELECT 1 FROM public.partner_contracts WHERE user_id=q.user_id AND status='ACTIVE') THEN RAISE EXCEPTION 'Active contract exists; review required'; END IF;
  INSERT INTO public.partner_contracts(user_id,plan_name,aporte_value,weekly_cap,total_cap,cotas,status,payment_status,payment_id,referred_by_user_id,referral_code,bonus_bids_received)
  VALUES(i.user_id,i.plan_name,i.aporte_value,i.weekly_cap,i.total_cap,coalesce(i.cotas,1),'ACTIVE','completed',q.tx_id,i.referred_by_user_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),coalesce(i.bonus_bids,0));
  UPDATE public.partner_payment_intents SET payment_status='approved' WHERE id=i.id;
 ELSIF typ='order' THEN
  SELECT * INTO o FROM public.orders WHERE id=entity FOR UPDATE;
  IF NOT FOUND OR o.winner_id<>q.user_id OR o.payment_id IS DISTINCT FROM q.tx_id OR o.final_price<>q.amount OR o.status<>'awaiting_payment' THEN RAISE EXCEPTION 'Order changed or already paid'; END IF;
  UPDATE public.orders SET status='paid',payment_method='PIX' WHERE id=o.id;
 ELSIF typ='credit' THEN
  SELECT * INTO d FROM public.partner_credit_debts WHERE id=entity FOR UPDATE;
  IF NOT FOUND OR d.user_id<>q.user_id OR d.status IN ('PAID','WRITTEN_OFF') OR d.amount-coalesce(d.paid_amount,0)<q.amount THEN RAISE EXCEPTION 'Debt changed or already paid'; END IF;
  n:=coalesce(d.paid_amount,0)+q.amount;
  UPDATE public.partner_credit_debts SET paid_amount=n,status=CASE WHEN n>=amount THEN 'PAID' ELSE status END,paid_at=CASE WHEN n>=amount THEN now() ELSE paid_at END,payment_transaction_id=q.tx_id WHERE id=d.id;
  UPDATE public.partner_credit_lines SET used_amount=greatest(0,used_amount-q.amount) WHERE id=d.credit_line_id;
  INSERT INTO public.partner_credit_transactions(credit_line_id,user_id,debt_id,tx_type,amount,description) VALUES(d.credit_line_id,d.user_id,d.id,'REPAYMENT',q.amount,'Devolução PIX MagenPay: '||q.tx_id);
 ELSIF typ IN ('regularize','upgrade','cotas-upgrade') THEN
  SELECT * INTO c FROM public.partner_contracts WHERE id=entity FOR UPDATE;
  IF NOT FOUND OR c.user_id<>q.user_id OR c.status<>'ACTIVE' THEN RAISE EXCEPTION 'Contract not eligible'; END IF;
  IF typ='regularize' THEN
   IF c.financial_status='paid' OR c.aporte_value<>q.amount THEN RAISE EXCEPTION 'Contract changed or regularized'; END IF;
   UPDATE public.partner_contracts SET financial_status='paid',financial_status_note='Pagamento regularizado via PIX MagenPay',financial_status_updated_at=now() WHERE id=c.id;
  ELSE
   IF c.total_received>=c.total_cap*0.8 OR c.plan_name IS DISTINCT FROM s->>'previous_plan_name' OR c.cotas<>(s->>'previous_cotas')::integer OR c.aporte_value<>(s->>'previous_aporte')::numeric THEN RAISE EXCEPTION 'Upgrade eligibility or source changed'; END IF;
   IF (s->>'new_aporte')::numeric-c.aporte_value<>q.amount THEN RAISE EXCEPTION 'Upgrade amount mismatch'; END IF;
   INSERT INTO public.partner_upgrades(partner_contract_id,previous_plan_name,previous_aporte_value,previous_weekly_cap,previous_total_cap,new_plan_name,new_aporte_value,new_weekly_cap,new_total_cap,total_received_at_upgrade,difference_paid,notes)
   VALUES(c.id,c.plan_name,c.aporte_value,c.weekly_cap,c.total_cap,s->>'new_plan_name',(s->>'new_aporte')::numeric,(s->>'new_weekly_cap')::numeric,(s->>'new_total_cap')::numeric,c.total_received,q.amount,'MagenPay TX: '||q.tx_id);
   UPDATE public.partner_contracts SET plan_name=s->>'new_plan_name',cotas=(s->>'new_cotas')::integer,aporte_value=(s->>'new_aporte')::numeric,weekly_cap=(s->>'new_weekly_cap')::numeric,total_cap=(s->>'new_total_cap')::numeric,bonus_bids_received=(s->>'new_bonus_bids')::integer WHERE id=c.id;
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported MagenPay charge'; END IF;
 UPDATE public.magenpay_charges SET status='completed',processed_at=now(),lease_until=NULL,last_error=NULL WHERE id=q.id;
 RETURN jsonb_build_object('status','paid','processed',true);
END; $$;
REVOKE ALL ON FUNCTION public.magenpay_apply_paid(uuid,text,numeric,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.magenpay_apply_paid(uuid,text,numeric,text,timestamptz) TO service_role;