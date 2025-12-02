-- Criar meta CPA para afiliados CPA existentes que não possuem meta ativa
INSERT INTO affiliate_cpa_goals (affiliate_id, value_per_conversion, conversions_target, status, cycle_number, current_conversions)
SELECT 
  a.id,
  COALESCE(a.cpa_value_per_conversion, 5.00),
  COALESCE(a.cpa_conversions_target, 50),
  'in_progress',
  1,
  0
FROM affiliates a
WHERE a.commission_type = 'cpa'
AND NOT EXISTS (
  SELECT 1 FROM affiliate_cpa_goals g 
  WHERE g.affiliate_id = a.id 
  AND g.status = 'in_progress'
);