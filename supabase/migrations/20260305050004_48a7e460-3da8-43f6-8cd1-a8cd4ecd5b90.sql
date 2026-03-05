
INSERT INTO admin_audit_log (
  admin_user_id,
  admin_name,
  action_type,
  target_type,
  target_id,
  description,
  old_values,
  new_values
) VALUES (
  'c793d66c-06c5-4fdf-9c2c-0baedd2694f6',
  'Sistema (Lovable)',
  'binary_points_correction',
  'partner_binary_positions',
  '879cbe85-7623-476c-8159-c9fa1eab0791',
  'Correção de pontos fantasmas: right_points e total_right_points zerados. Mariano tinha 1000 pts na perna direita sem registro correspondente no binary_points_log. A propagação do Luiz Cláudio (1o indicado direto) foi bloqueada por qualifier_skip, mas o saldo foi atualizado indevidamente.',
  '{"right_points": 1000, "total_right_points": 1000}'::jsonb,
  '{"right_points": 0, "total_right_points": 0}'::jsonb
);
