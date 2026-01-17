-- Limpar dados antigos com datas incorretas (bug de timezone)
DELETE FROM daily_revenue_config WHERE date IN ('2026-01-11', '2026-01-17');

-- Nota: As datas 12/01 a 16/01 pertencem à semana correta (12/01-18/01)
-- Apenas removemos 11/01 (pertence à semana anterior) e 17/01 será substituído por 18/01
-- O administrador precisará reconfigurar os valores manualmente pela interface