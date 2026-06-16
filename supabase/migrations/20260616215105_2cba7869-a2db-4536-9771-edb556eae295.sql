ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bettor_contract_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS bettor_contract_version text;