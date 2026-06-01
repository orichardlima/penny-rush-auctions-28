ALTER TABLE public.partner_contracts DISABLE TRIGGER protect_partner_contract_sensitive_fields;

UPDATE public.partner_contracts pc
SET available_balance = GREATEST(0,
      COALESCE((
        SELECT SUM(amount) FROM public.partner_payouts
        WHERE partner_contract_id = pc.id AND status = 'PAID'
      ), 0) - COALESCE(pc.total_withdrawn, 0)
    ),
    total_received = COALESCE((
        SELECT SUM(amount) FROM public.partner_payouts
        WHERE partner_contract_id = pc.id AND status = 'PAID'
      ), 0),
    updated_at = now()
WHERE id = 'abd3ffff-d7fc-4f18-beb6-ac55986cefba';

ALTER TABLE public.partner_contracts ENABLE TRIGGER protect_partner_contract_sensitive_fields;