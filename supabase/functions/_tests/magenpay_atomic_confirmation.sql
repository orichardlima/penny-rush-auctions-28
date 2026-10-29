-- Reversible database regression checks; no provider calls and no permanent credits.
DO $$
DECLARE u uuid; cpf text; purchase uuid; charge uuid; before_balance integer; tx text; result jsonb;
BEGIN
 SELECT user_id,regexp_replace(profiles.cpf,'\D','','g') INTO u,cpf FROM public.profiles WHERE profile_complete AND NOT coalesce(is_blocked,false) AND length(regexp_replace(profiles.cpf,'\D','','g'))=11 LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'No eligible fixture'; END IF;
 BEGIN
  tx:='regression'||replace(gen_random_uuid()::text,'-','');
  SELECT bids_balance INTO before_balance FROM public.profiles WHERE user_id=u;
  INSERT INTO public.bid_purchases(user_id,package_id,bids_purchased,amount_paid,payment_status,payment_id) SELECT u,id,15,15,'pending',tx FROM public.bid_packages LIMIT 1 RETURNING id INTO purchase;
  INSERT INTO public.magenpay_charges(tx_id,external_reference,user_id,amount,payer_cpf,pix_copy_paste,snapshot) VALUES(tx,purchase::text,u,15,cpf,'test-only',jsonb_build_object('type','bid_purchase','entity_id',purchase)) RETURNING id INTO charge;
  BEGIN PERFORM public.magenpay_apply_paid(charge,tx,14.99,cpf); RAISE EXCEPTION 'WRONG_AMOUNT_ACCEPTED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='WRONG_AMOUNT_ACCEPTED' THEN RAISE; END IF; END;
  BEGIN PERFORM public.magenpay_apply_paid(charge,'othertransaction',15,cpf); RAISE EXCEPTION 'WRONG_TX_ACCEPTED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='WRONG_TX_ACCEPTED' THEN RAISE; END IF; END;
  BEGIN PERFORM public.magenpay_apply_paid(charge,tx,15,'00000000000'); RAISE EXCEPTION 'WRONG_CPF_ACCEPTED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='WRONG_CPF_ACCEPTED' THEN RAISE; END IF; END;
  result:=public.magenpay_apply_paid(charge,tx,15,cpf);
  IF result->>'processed'<>'true' THEN RAISE EXCEPTION 'Payment not processed'; END IF;
  result:=public.magenpay_apply_paid(charge,tx,15,cpf);
  IF result->>'already_processed'<>'true' THEN RAISE EXCEPTION 'Not idempotent'; END IF;
  IF (SELECT bids_balance FROM public.profiles WHERE user_id=u)<>coalesce(before_balance,0)+15 THEN RAISE EXCEPTION 'Duplicate or missing credit'; END IF;
  IF (SELECT count(*) FROM public.payment_confirmations WHERE provider='magenpay' AND external_transaction_id=tx)<>1 THEN RAISE EXCEPTION 'Confirmation count invalid'; END IF;
  RAISE EXCEPTION 'ROLLBACK_MAGEN_TEST';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ROLLBACK_MAGEN_TEST' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS: amount, transaction, CPF, atomic credit and repeated confirmation; all fixtures reverted';
END $$;