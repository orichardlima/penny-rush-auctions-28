# Leilões pararam de ser lançados automaticamente

## O que foi verificado agora

- **Nenhum leilão ativo ou aguardando.** Todos os 2.450 registros da tabela `auctions` estão com status `finished`. O último leilão criado foi hoje às **03:05 UTC (00:05 Bahia)**.
- **O cron de reposição está falhando.** O job `auto-replenish-auctions` (a cada 5 min) retorna `job startup timeout` em todas as execuções recentes — 03:19, 03:22, 03:27 e agora 12:22 e 12:23.
- **A edge function nunca é chamada.** Não há nenhum log em `auto-replenish-auctions`, ou seja, o cron morre antes de disparar a requisição.
- **O banco está saturado.** Nas últimas 2 horas: 89 execuções de cron falharam, 28 ficaram travadas em `running` e apenas 143 concluíram. Consultas diretas ao banco já retornam `remaining connection slots are reserved for roles with the SUPERUSER attribute`.
- **Causa provável da saturação:** existem **72 jobs de cron disparando a cada minuto** (60 `bot-exec-XX` + 12 `bot-tick-XX`), além dos demais. O pg_cron tem um número limitado de workers/conexões; quando todos ficam ocupados, os jobs restantes — incluindo o de reposição de leilões — recebem `job startup timeout` e simplesmente não rodam.

Resumindo: os leilões **não** estão sendo lançados automaticamente desde a madrugada, e o motivo é esgotamento de workers/conexões do banco causado pelo excesso de jobs de bot por minuto.

## Plano de correção

### Passo 1 — Voltar a ter leilões no ar (imediato)
Disparar manualmente a rotina de reposição para recriar o lote mínimo de leilões, e confirmar na tela que voltaram a aparecer.

### Passo 2 — Reduzir a pressão do cron de bots (raiz do problema)
Consolidar os 60 jobs `bot-exec-XX` (1 por segundo de deslocamento) em um número muito menor de jobs, mantendo a mesma cadência efetiva de execução:

- Substituir os 60 jobs por poucos jobs (por exemplo 4 a 6 por minuto) que internamente varrem os leilões pendentes em laço curto, preservando o comportamento atual de timing natural dos bots.
- Fazer o mesmo tipo de consolidação nos `bot-tick-XX` (12 jobs), reduzindo para uma quantidade compatível.
- Manter idempotência e as travas existentes, sem alterar nenhuma regra de lance, de vitória ou de faturamento.

### Passo 3 — Blindar o cron de reposição
- Dar prioridade ao `auto-replenish-auctions` executando-o em um horário deslocado (segundos fora do pico dos jobs de bot).
- Ajustar o comando do cron para incluir o cabeçalho `x-replenish-secret`, hoje ausente na chamada — se a variável `REPLENISH_TRIGGER_SECRET` estiver configurada, a função rejeita a chamada com 401 mesmo quando o cron consegue rodar. Isso será confirmado antes de mudar.
- Registrar cada execução para permitir diagnóstico rápido em caso de nova falha.

### Passo 4 — Alerta de "sem leilões"
Criar uma verificação simples que grava um alerta administrativo quando o número de leilões `active` + `waiting` ficar em zero por mais de X minutos, para o problema não passar despercebido de novo.

## Notas técnicas

- Nenhuma alteração em regras de negócio: lances, bots vencedores, pontos, receita e finalização permanecem exatamente como estão.
- As mudanças são de agendamento (`cron.job`) e de infraestrutura de execução, mais um pequeno ajuste no comando HTTP do job de reposição.
- A consolidação dos jobs será feita com `cron.unschedule` dos jobs redundantes e `cron.schedule` dos novos, em uma única migration, mantendo os nomes documentados.
