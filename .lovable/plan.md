# Recolocar os leilões no ar e evitar que parem de novo

## Situação atual (verificada agora, 23:20 Bahia)
- Site no ar, sem manutenção.
- **Nenhum leilão ativo ou aguardando.** Último lance: 21/10 às 04:51 (Bahia). O site está sem leilões há cerca de 18 horas.
- A tarefa automática que cria novos leilões (a cada 5 min) falha desde 21/10 às 04:47 com "tempo esgotado para iniciar" e depois parou de rodar.
- Motivo: existem 106 tarefas automáticas, 84 delas só de bots, todas rodando a cada minuto. Elas ocupam toda a fila, e a tarefa de criar leilões nunca consegue vez.

## O que será feito
1. **Na hora:** rodar a criação de leilões manualmente para o site voltar a ter leilões ativos, e confirmar que eles começam e recebem lances.
2. **Juntar as 84 tarefas de bots em poucas** (uma para os bots e uma para proteger os cronômetros), sem mudar o comportamento dos bots: mesmos tempos, mesmas regras, todo leilão continua terminando com bot.
3. **Proteger a criação de leilões:** ela continua a cada 5 minutos, e entra um alerta para o admin se ficar mais de 15 minutos sem leilão ativo.
4. Acompanhar por alguns minutos: leilões abrindo, lances de bots e nenhuma falha na fila.

Nada muda nas telas, em valores ou nas regras de quem ganha.

## Detalhes técnicos
- Teste imediato: `select` na função chamada pelo job `auto-replenish-auctions`.
- Substituir os jobs `bot-tick-*`, `bot-exec-*` e `sync-timers-protection-*` por 2 jobs `pg_cron` que fazem um laço interno (sub-ticks de segundos com `pg_sleep`), chamando as mesmas funções na mesma ordem. Antes de apagar, salvar a lista atual de jobs para poder voltar atrás.
- Alerta: verificação dentro de `run_bonus_maintenance`-like ou de um job leve que grava notificação de admin quando `count(active+waiting)=0` por mais de 15 min.
