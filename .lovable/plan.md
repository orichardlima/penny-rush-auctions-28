## Objetivo
Garantir que o **panic bid sempre dispare a 1,5s do fim**, independentemente da saturação atual do `pg_cron`. Manter bots, finalização, vencedor, UI, pagamentos, parceiros, RLS e contratos intocados.

## Causa raiz (confirmada)
O panic bid existe e está intacto em `sync-timers-and-protection` (linhas ~308-329). Ele só roda quando esse ciclo executa. Hoje, ~50% das execuções dos 12 crons `sync-timers-protection-*` falham com `job startup timeout` e as bem-sucedidas levam 15-35s — abrindo janelas de 10-20s sem nenhum ciclo ativo. Quando um leilão entra em `time_left ≤ 1,5s` dentro dessa janela, o panic não dispara e o timer chega a zerar antes do safety net de inatividade (45s).

Isso é **saturação do pool de workers do pg_cron** (60 `bot-exec-*` + 12 `sync-timers-*` + 6 `bot-tick-*` + utilitários competindo no mesmo minuto). Não foi causado pelas alterações recentes; só ficou mais visível agora que a reposição voltou e há mais leilões ativos simultâneos.

## Correção proposta: Panic Bid nativo em SQL (rede de segurança independente)

Cria um caminho **redundante e em SQL puro** para o panic, que não depende de edge function nem de HTTP. Continua existindo o panic atual dentro de `sync-timers-and-protection` — apenas adicionamos um segundo gatilho mais barato e confiável.

### O que muda

1. **Nova função SQL `execute_panic_bids()`** (SECURITY DEFINER):
   - `SELECT ... FOR UPDATE SKIP LOCKED` em `auctions` onde:
     - `status = 'active'`
     - `last_bid_at < now() - interval '13500 ms'` (equivale a `time_left ≤ 1,5s` na janela de 15s)
     - `(scheduled_bot_bid_at IS NULL OR scheduled_bot_bid_at > last_bid_at + interval '14 seconds')`
     - sem líder real elegível (predefinido/open_win) — replica a checagem já existente
   - Para cada leilão elegível: `UPDATE` setando `scheduled_bot_bid_at = now() + interval '300 ms'`, `scheduled_bot_band = 'panic'`.
   - Chama `execute_overdue_bot_bids()` (função já validada, já atômica) para executar imediatamente.
   - Retorna `{ checked, scheduled, executed }` para logging.

2. **12 crons `panic-tick-NN`** (offsets 0/5/10/.../55s), cada um executando apenas `SELECT public.execute_panic_bids();`. 
   - Carga mínima (~20ms por chamada, sem HTTP).
   - Não passa pelo worker de HTTP do pg_net.

### O que NÃO muda
- `bot-exec`, `bot-tick`, `sync-timers-and-protection`, `execute_overdue_bot_bids`, frequência dos bots, distribuição de bandas, panic atual da edge function, finalização, vencedor, UI, pagamentos, parceiros, contratos, RLS, fury vault, regras de negócio.
- O panic da edge function continua existindo — o novo caminho só age quando ele já falhou em rodar a tempo.

### Rollback (2 comandos)
```sql
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'panic-tick-%';
DROP FUNCTION IF EXISTS public.execute_panic_bids();
```

### Validação (30 min de observação após aplicar)
- `finish_reason = 'inactivity_forced'` deve zerar (era o sintoma do timer chegando a 0).
- Logs do Postgres mostrando execuções de `execute_panic_bids` com `scheduled > 0` quando aplicável.
- Distribuição de `last_bot_band` (early/mid-low/middle/late/rush) inalterada — confirma que panic só atua como rede.
- Finalizações por `time_limit`, `max_price`, `revenue_target` inalteradas em volume e padrão.
- `cron.job_run_details` dos `panic-tick-*` com >95% `succeeded` e duração <100ms.
- Sem novos leilões com `ends_at NULL`; reposição automática seguindo normal.

## Pergunta antes de aplicar
Aprovo seguir com essa migration (criar `execute_panic_bids` + 12 crons `panic-tick-*`)? Nada além disso será tocado.