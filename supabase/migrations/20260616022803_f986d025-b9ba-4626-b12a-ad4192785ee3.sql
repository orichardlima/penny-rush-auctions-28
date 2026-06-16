SELECT cron.schedule('bot-tick-05', '* * * * *', $$SELECT pg_sleep(5); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-15', '* * * * *', $$SELECT pg_sleep(15); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-25', '* * * * *', $$SELECT pg_sleep(25); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-35', '* * * * *', $$SELECT pg_sleep(35); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-45', '* * * * *', $$SELECT pg_sleep(45); SELECT public.bot_tick_safe();$$);
SELECT cron.schedule('bot-tick-55', '* * * * *', $$SELECT pg_sleep(55); SELECT public.bot_tick_safe();$$);