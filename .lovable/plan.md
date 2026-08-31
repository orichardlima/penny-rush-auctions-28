# Leilões parados: o agendador externo (cron-job.org) foi desativado

## O que os dados mostram

- **Nenhum leilão no ar agora:** 0 `active` e 0 `waiting`. O último leilão criado foi hoje às **03:05 UTC**.
- **A última execução bem-sucedida da reposição foi às 03:25 UTC** (`auto_replenish_last_run = 2026-08-31T03:25:02Z`). Depois disso, nada mais rodou.
- **O disparo real vem de fora, pelo cron-job.org.** No print: o job "Show de Lances - Auto Replenish Auctions" apontando para `.../functions/v1/auto-replenish-auctions` aparece como **Failed (DNS lookup)**, o painel mostra **0 enabled / 1 disabled** e **"No upcoming executions"**. Ou seja, o cron-job.org desabilitou o job automaticamente após as falhas ocorridas enquanto o Supabase estava pausado.
- **O cron interno do banco existe mas não substitui o externo:** o job `auto-replenish-auctions` (pg_cron, a cada 5 min) só registra `job startup timeout` — nunca chega a chamar a função (não há um único log na edge function). Além disso, o comando dele **não envia o cabeçalho `x-replenish-secret`**, então, se `REPLENISH_TRIGGER_SECRET` estiver configurado, a função responderia 401 mesmo se o job rodasse.
- **A configuração está correta e ligada:** `auto_replenish_enabled = true`, mínimo 3 leilões, lote de 2, duração 6–8h.

Conclusão: os leilões não voltaram sozinhos porque o gatilho externo está desativado desde a pausa, e o gatilho interno de reserva está quebrado.

## Plano

### Passo 1 — Repor os leilões agora
Chamar a função `auto-replenish-auctions` diretamente para recriar o lote mínimo e confirmar que os leilões voltam a aparecer na home e em `/leiloes`.

### Passo 2 — Reativar o disparo externo
Você reabilita o job no cron-job.org (ele está apenas desativado, a URL continua correta). Depois disso confirmo pelos logs da edge function que as execuções voltaram.

### Passo 3 — Corrigir o gatilho interno como reserva
Para não depender de um único agendador:
- Ajustar o comando do cron interno para enviar o `x-replenish-secret` (confirmando antes se o segredo existe).
- Reagendar esse job em janela deslocada e cadência menor, fora do pico dos jobs de bot — hoje há 72+ jobs por minuto (`bot-exec-XX`, `bot-tick-XX`, `sync-timers-protection-XX`) saturando os workers do pg_cron e causando os `job startup timeout`.
- Consolidar esses jobs de bot em poucos jobs por minuto, preservando exatamente a cadência e o comportamento atual dos lances.

### Passo 4 — Alerta de "sem leilões"
Registrar um alerta administrativo quando `active + waiting` ficar em zero por mais de alguns minutos, para que uma nova pausa ou queda do agendador apareça imediatamente.

## Notas técnicas

- Nenhuma regra de negócio muda: lances, bots vencedores, pontos, receita e finalização permanecem iguais.
- As alterações se limitam ao agendamento (`cron.job`) e ao comando HTTP do job de reposição.
- A reposição usa `product_templates` ativos com cooldown de 4h por título e mínimo de 3 leilões, conforme `system_settings`.
