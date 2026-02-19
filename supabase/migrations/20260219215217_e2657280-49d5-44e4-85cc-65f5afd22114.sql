
-- Criar tabela para intenções de pagamento de parceiros (pre-contrato)
CREATE TABLE public.partner_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.partner_plans(id),
  plan_name text NOT NULL,
  aporte_value numeric NOT NULL,
  weekly_cap numeric NOT NULL,
  total_cap numeric NOT NULL,
  bonus_bids integer NOT NULL DEFAULT 0,
  referral_code text,
  referred_by_user_id uuid,
  payment_id text,
  payment_status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone DEFAULT (now() + interval '30 minutes'),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- Enable RLS
ALTER TABLE public.partner_payment_intents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can insert own intents"
ON public.partner_payment_intents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own intents"
ON public.partner_payment_intents
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all intents"
ON public.partner_payment_intents
FOR ALL
USING (is_admin_user(auth.uid()));

-- Index para busca por payment_id (usado pelo webhook)
CREATE INDEX idx_partner_payment_intents_payment_id ON public.partner_payment_intents(payment_id);

-- Index para busca por user_id
CREATE INDEX idx_partner_payment_intents_user_id ON public.partner_payment_intents(user_id);
