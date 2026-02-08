-- Desativar cron job duplicado timer-protection (Job 41) - edge function não existe
SELECT cron.unschedule(41);

-- Desativar cron job timer-decrement (Job 43) - timer calculado localmente no frontend
SELECT cron.unschedule(43);