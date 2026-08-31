# Retomar o lançamento automático de leilões após a reativação do banco

## Situação verificada agora (12:28 UTC / 09:28 Bahia)

- **Continua sem nenhum leilão no ar:** a consulta por leilões `active` ou `waiting` retorna zero. O último leilão criado foi hoje às 03:05 UTC.
- **A pausa do Supabase explica a parada** — durante o período pausado nada rodou.
- **Mas o agendador ainda não se recuperou sozinho.** Nos últimos 6 minutos, já com o banco reativado, a maioria das execuções de cron continua com `job startup timeout` (ex.: `bot-exec-03`, `bot-exec-06`, `bot-exec-10`, `bot-tick-05`, `bot-tick-10`, `sync-timers-protection-05/10/20`). Apenas parte dos jobs conclui.
- **O `auto-replenish-auctions` não rodou no horário previsto das 12:27** — as últimas tentativas registradas (12:22 e 12:23) falharam com `job startup timeout`.
- **Causa da não recuperação:** há **72+ jobs disparando a cada minuto** (60 `bot-exec-XX`, 12 `bot-tick-XX`, mais os `sync-timers-protection-XX`). O pg_cron tem um número limitado de workers; com todos ocupados, os jobs restantes — inclusive o de reposição de leilões — nem chegam a iniciar.

Ou seja: a pausa derrubou os leilões, e a lotação do agendador está impedindo que o sistema volte sozinho.

## Plano

### Passo 1 — Repor os leilões imediatamente
Disparar a rotina de reposição manualmente para recriar o lote mínimo de leilões e confirmar que voltaram a aparecer na home e em `/leiloes`.

### Passo 2 — Desafogar o agendador (para o sistema voltar a se sustentar sozinho)
Consolidar os jobs por minuto sem mudar a cadência efetiva dos bots:

- Substituir os 60 `bot-exec-XX` por poucos jobs (4 a 6 por minuto) que varrem os lances pendentes em laço curto interno, preservando o timing natural atual.
- Reduzir de forma equivalente os `bot-tick-XX` e os `sync-timers-protection-XX`.
- Manter todas as travas e a idempotência existentes; nenhuma regra de lance, de vencedor ou de faturamento muda.

### Passo 3 — Blindar o cron de reposição
- Rodar o `auto-replenish-auctions` em janela deslocada, fora do pico dos jobs de bot.
- Verificar se `REPLENISH_TRIGGER_SECRET` está configurado: o comando do cron hoje **não** envia o cabeçalho `x-replenish-secret`, o que faria a função responder 401 mesmo quando o job conseguisse rodar. Se o segredo existir, incluir o cabeçalho no comando.

### Passo 4 — Alerta de "sem leilões"
Verificação simples que registra um alerta administrativo quando o total de leilões `active` + `waiting` ficar em zero por mais de alguns minutos — assim uma nova pausa ou falha aparece imediatamente em vez de passar despercebida.

## Notas técnicas

- Nenhuma alteração de regra de negócio: lances, bots vencedores, pontos, receita e finalização permanecem como estão.
- As mudanças ficam em `cron.job` (unschedule dos jobs redundantes + schedule dos consolidados, em uma única migration) e no comando HTTP do job de reposição.
- A reposição usa `product_templates` ativos, respeitando cooldown por título e o mínimo configurado em `system_settings`.
