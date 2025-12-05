-- Add setting for finished auctions display hours
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES ('finished_auctions_display_hours', '48', 'number', 'Horas que leilões finalizados ficam visíveis na home (0 = não exibir)')
ON CONFLICT (setting_key) DO NOTHING;

-- Add is_hidden column to auctions table
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;