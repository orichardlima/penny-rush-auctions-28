# Lançamento automático de leilões: restaurado + blindagem contra nova parada

## Confirmação — está funcionando de novo

Verificado agora (13:00 UTC / 10:00 Bahia):

- O cron externo voltou a chamar a função: log `AUTO_REPLENISH_AUTH_DIAGNOSTIC` com `match: true` (o segredo está correto).
- Novo leilão criado às 13:00:13 — "Smart TV 43\" 4K UHD" (`07d7bf78…`), término previsto 20:16 UTC.
- Estado atual: **2 leilões ativos + 1 aguardando** (mínimo configurado = 3). O motor está repondo sozinho.
- Templates disponíveis: 62 no total, 38 elegíveis no momento (o resto em cooldown de 4h).

Ou seja: a causa da parada foi a pausa do banco por pagamento, que fez o cron-job.org falhar por DNS e se autodesativar. Com o banco e o cron reativados, o fluxo normalizou sem nenhuma alteração de código.

## O que ainda vale corrigir (para não depender de um único gatilho)

### 1. Gatilho interno de reserva no banco
Hoje existe um `pg_cron` chamado `auto-replenish-auctions` que **nunca funciona**: todas as execuções terminam em `job startup timeout` e nenhuma requisição chega à função. Além disso, o comando dele **não envia o cabeçalho `x-replenish-secret`** — e o segredo está ativo, então ele receberia 401 mesmo se rodasse.

Correção: incluir o cabeçalho no comando e reagendá-lo em cadência baixa (a cada 15 min) e em janela deslocada, apenas como rede de segurança caso o cron externo caia de novo. A trava de 60s já existente na função impede execução duplicada com o cron externo.

### 2. Desafogar o agendador do banco
Há **72+ jobs disparando a cada minuto** (`bot-exec-XX` ×60, `bot-tick-XX` ×12, `sync-timers-protection-XX`), o que satura os workers do pg_cron e é a razão dos `job startup timeout`.

Correção: consolidar os `bot-exec-XX` em poucos jobs por minuto que varrem os lances pendentes em laço interno curto, preservando exatamente a mesma cadência e o mesmo comportamento dos bots. Mesmo tratamento para `bot-tick-XX` e `sync-timers-protection-XX`.

### 3. Alerta de "sem leilões"
Registrar um alerta administrativo quando `active + waiting` ficar em zero por mais de alguns minutos, para que uma nova pausa, falha de pagamento ou queda do cron externo apareça de imediato em vez de ficar horas sem leilão.

## Notas técnicas

- Nenhuma regra de negócio muda: lances, bots vencedores, pontos, receita e finalização permanecem exatamente como estão.
- As alterações ficam restritas a `cron.job` (comando e agendamento) e a uma verificação de alerta.
- Se você preferir manter apenas o cron externo como gatilho, dá para fazer só os itens 2 e 3.
