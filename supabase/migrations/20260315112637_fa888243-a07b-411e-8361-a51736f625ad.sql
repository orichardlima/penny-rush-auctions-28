-- 1. Atualizar tempo de exibição de leilões finalizados para 18 horas
UPDATE system_settings 
SET setting_value = '18' 
WHERE setting_key = 'finished_auctions_display_hours';

-- 2. Filtrar leilões ocultos na policy SELECT de auctions
DROP POLICY "Anyone can view auctions" ON auctions;
CREATE POLICY "Anyone can view auctions" ON auctions
  FOR SELECT TO public
  USING (is_hidden = false OR is_admin_user(auth.uid()));