-- 1) SLA padrão de estorno (em dias corridos)
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('termination_refund_sla_days', '7', 'Prazo padrão (em dias corridos) para pagamento do estorno após aprovação do encerramento antecipado.')
ON CONFLICT (setting_key) DO NOTHING;

-- 2) Novas colunas na tabela de encerramentos
ALTER TABLE public.partner_early_terminations
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_reference TEXT;

-- 3) Backfill: pedidos COMPLETED ganham approved_at e paid_at = processed_at;
--    pedidos APPROVED (mas não pagos) ganham apenas approved_at = processed_at.
UPDATE public.partner_early_terminations
SET approved_at = COALESCE(approved_at, processed_at)
WHERE status IN ('APPROVED', 'COMPLETED') AND processed_at IS NOT NULL;

UPDATE public.partner_early_terminations
SET paid_at = COALESCE(paid_at, processed_at)
WHERE status = 'COMPLETED' AND processed_at IS NOT NULL;