ALTER TABLE public.partner_contracts
  ADD COLUMN financial_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN financial_status_updated_at TIMESTAMPTZ,
  ADD COLUMN financial_status_note TEXT;

CREATE INDEX idx_partner_contracts_financial_status ON public.partner_contracts (financial_status);