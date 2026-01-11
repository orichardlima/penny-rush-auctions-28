-- Renomear colunas para refletir lógica semanal
ALTER TABLE partner_plans RENAME COLUMN monthly_cap TO weekly_cap;
ALTER TABLE partner_contracts RENAME COLUMN monthly_cap TO weekly_cap;
ALTER TABLE partner_payouts RENAME COLUMN monthly_cap_applied TO weekly_cap_applied;
ALTER TABLE partner_upgrades RENAME COLUMN previous_monthly_cap TO previous_weekly_cap;
ALTER TABLE partner_upgrades RENAME COLUMN new_monthly_cap TO new_weekly_cap;