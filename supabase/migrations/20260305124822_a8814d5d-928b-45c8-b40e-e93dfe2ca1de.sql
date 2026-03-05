-- Corrigir finished_at dos leilões finalizados por horário limite
-- Apenas onde finished_at > ends_at (cron detectou tarde)
-- Leilões onde finished_at < ends_at foram encerrados por outra condição e mantêm seu timestamp original
UPDATE auctions
SET finished_at = ends_at
WHERE status = 'finished'
  AND ends_at IS NOT NULL
  AND finished_at > ends_at;