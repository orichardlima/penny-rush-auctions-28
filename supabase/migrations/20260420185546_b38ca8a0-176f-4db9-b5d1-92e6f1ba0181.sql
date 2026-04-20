-- 1) Cancelar a duplicata específica do João (criada 1s depois da legítima)
UPDATE public.partner_withdrawals
SET 
  status = 'REJECTED',
  rejection_reason = 'Duplicidade — clique duplo. Solicitação idêntica criada 1s antes (252401ac).',
  updated_at = now()
WHERE id = 'b0e02402-0000-0000-0000-000000000000'::uuid
  OR (
    partner_contract_id = '236eac8e-c587-44cb-bfad-9f78b38a21ce'::uuid
    AND status = 'APPROVED'
    AND amount = 980.28
    AND created_at > '2026-04-20 10:33:13'::timestamptz
    AND created_at < '2026-04-20 10:33:14'::timestamptz
  );

-- 2) Criar índice único parcial para impedir saques ativos concorrentes no mesmo contrato
CREATE UNIQUE INDEX IF NOT EXISTS uniq_partner_active_withdrawal
ON public.partner_withdrawals (partner_contract_id)
WHERE status IN ('PENDING', 'APPROVED');