## Diagnóstico

O erro **"Ops! Algo deu errado"** ao dar lance é causado por um deadlock lógico no bot worker:

### A cadeia de falha

1. Os leilões `Galaxy Watch 6 44mm` e `Micro-ondas 32L Inox` (e provavelmente outros) estão com `status='active'` mas `ends_at` no passado (várias horas atrás). Ficaram "presos".
2. O trigger `prevent_bids_on_inactive_auctions` rejeita qualquer INSERT em `bids` quando `ends_at < now() - 5s` → erro `Cannot place bids on inactive or finished auctions`.
3. Esse erro atinge tanto usuários reais quanto bots.
4. **O que mantém os leilões presos:** `bot_tick()` chama `execute_overdue_bot_bids()` **antes** de `bot_protection_loop()` (que é quem finaliza leilões expirados). Quando `execute_overdue_bot_bids` tenta inserir um lance agendado num leilão com `ends_at` vencido, o trigger rejeita, a exceção propaga, `bot_tick_safe` aborta — e o `bot_protection_loop` nunca executa. Loop infinito.

Logs confirmam (todos os crons `bot-tick-*` falhando):

```
ERROR: Cannot place bids on inactive or finished auctions
CONTEXT: prevent_bids_on_inactive_auctions
  ← execute_overdue_bot_bids line 49 (INSERT INTO bids)
  ← bot_tick line 4 (PERFORM)
  ← bot_tick_safe line 9
```

## Solução

### 1. Corrigir `execute_overdue_bot_bids()` para pular leilões expirados

Adicionar filtro `AND (ends_at IS NULL OR ends_at >= now() - interval '5 seconds')` no SELECT principal, e limpar o agendamento desses leilões. Assim a função nunca tenta inserir em leilão que o trigger rejeitaria, e a execução de `bot_tick` chega até `bot_protection_loop` que finaliza o leilão normalmente.

### 2. Cleanup imediato dos leilões presos

Forçar finalização de todos os leilões `status='active' AND ends_at < now() - 1 minute AND finished_at IS NULL` via `_bot_finalize_auction(..., 'time_limit', ...)`. Isso destrava o sistema na hora, sem precisar esperar o próximo ciclo de cron.

## Detalhes técnicos

Uma única migration com:
- `CREATE OR REPLACE FUNCTION public.execute_overdue_bot_bids()` com o filtro adicional e `UPDATE auctions SET scheduled_bot_bid_at=NULL` para leilões expirados encontrados
- Loop `DO $$` chamando `_bot_finalize_auction` para cada leilão preso (cleanup)

Nada muda na UI, hooks, RLS, schema, ou em qualquer outra função. O comportamento esperado dos bots, do trigger de bloqueio, da função `place_bid` e do botão "DAR LANCE" permanece idêntico — apenas para de travar quando bots tropeçam em leilões expirados.

## Fora de escopo

- Mudanças no frontend
- Alteração do trigger `prevent_bids_on_inactive_auctions`
- Alteração da ordem `execute_overdue_bot_bids → bot_protection_loop` (mantida)
- Otimizações de cron / compute (já tratadas em rodada anterior)
