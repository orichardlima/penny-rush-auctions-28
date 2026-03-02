-- Ocultar todos os leilões finalizados visíveis
UPDATE auctions SET is_hidden = true WHERE status = 'finished' AND (is_hidden = false OR is_hidden IS NULL);