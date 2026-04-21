

## Diagnóstico do problema

### O que está realmente acontecendo

Os bots **estão dando lances corretamente** (a cada ~13s no leilão observado), mas a UI fica em "Verificando lances válidos" por longos períodos por **3 causas combinadas**:

### Causa 1 — Os crons "−30" estão dormindo errado e travando os "−00"

Olhando os jobs do `pg_cron`:
```
bot-protection-loop-00: SELECT bot_protection_loop_safe()           → dura 5-30ms
bot-protection-loop-30: SELECT pg_sleep(30); SELECT bot_protection_loop_safe()  → dura 30s
execute-overdue-bot-bids-00: SELECT execute_overdue_bot_bids_safe() → dura 5ms
execute-overdue-bot-bids-30: SELECT pg_sleep(30); SELECT execute_overdue_bot_bids_safe() → dura 30s
```

Os jobs `−30` foram criados com `pg_sleep(30)` para deslocar a execução em 30 segundos do minuto. **Mas o `pg_sleep` é executado dentro de uma transação que mantém posse da conexão de cron por 30s, e a função `*_safe` usa `pg_try_advisory_lock`**. Quando o `−00` da execução seguinte tenta rodar (60s após o `−30` iniciar, portanto 30s após o `_safe` concluir), o lock já está liberado — está OK.

**O problema real:** o `pg_sleep` não é o pattern recomendado e desperdiça uma conexão por 30s a cada minuto, mas funciona. **O verdadeiro gargalo é outro:** observei que o `execute_overdue_bot_bids` (a função que efetivamente executa o lance no horário agendado) só roda a cada 30s. Se um bot foi agendado para `last_bid + 7s`, ele só será efetivamente inserido na próxima execução do cron — pode esperar até **30 segundos extras** após o horário previsto.

Exemplo real: lance do usuário às 17:09:00 → bot agendado para 17:09:07 → cron `−00` rodou 17:09:00 (sem agendamento ainda) → próximo `−30` roda 17:09:30 → bot insere lance só às 17:09:30. **Resultado: 30s sem lance, timer chega a 0, UI fica "Verificando" 23s.**

### Causa 2 — O agendamento depende de 2 passes do cron

Fluxo atual:
1. Usuário/bot dá lance → `last_bid_at = T0`, `scheduled_bot_bid_at = NULL`
2. `bot_protection_loop` roda, vê inatividade ≥5s, agenda bot para `T0 + 7s`
3. `execute_overdue_bot_bids` roda, executa quando passar de `T0+7s`

Como cada passo depende de um cron de 30s, o gap pode chegar a **~30-60s no pior caso**.

### Causa 3 — O safety net mata leilões inativos com 60s

Em `bot_protection_loop` linha 76: `IF v_seconds_since_last_bid >= 60 THEN finalize`. Como o gap pode chegar perto de 60s, leilões podem ser finalizados prematuramente — agravando a sensação de "travado".

---

## Correção proposta

### Mudança 1 — Substituir os 4 jobs de cron por jobs reais a cada 30s

Trocar o padrão `pg_sleep(30)` (que desperdiça conexão e adiciona latência) por **agendamento nativo a cada 30s usando `pg_cron` extension supports `30 seconds`** via padrão `*/30 * * * * *` (6 campos) ou criando 2 jobs por minuto sem sleep.

Como o `pg_cron` no Supabase só aceita 5 campos (granularidade de minuto), a abordagem correta é manter 2 jobs por função (00s e 30s do minuto), **mas executar o `pg_sleep` apenas no agendamento**, não dentro da transação de trabalho:

```sql
SELECT cron.schedule('bot-protection-loop-30', '* * * * *', 
  $$ DO $body$ BEGIN PERFORM pg_sleep(30); PERFORM bot_protection_loop_safe(); END $body$ $$);
```

Isso já é equivalente ao atual. **A causa real é a separação dos 2 cron jobs (`bot_protection_loop` agenda, `execute_overdue_bot_bids` executa).** Vou unificar:

### Mudança 2 (principal) — Fundir agendamento + execução em um único loop a cada 10s

Em vez de depender de dois crons separados de 30s, criar **uma função `bot_tick()` que faz agendamento E execução do que está vencido na mesma passagem**, e rodar a cada 10 segundos.

Como `pg_cron` não suporta sub-minuto via cron expression no Supabase, usar a abordagem de **6 jobs por minuto (00, 10, 20, 30, 40, 50)** com `pg_sleep` nos 5 deslocados:

```sql
SELECT cron.schedule('bot-tick-00', '* * * * *', 'SELECT bot_tick_safe();');
SELECT cron.schedule('bot-tick-10', '* * * * *', 'SELECT pg_sleep(10); SELECT bot_tick_safe();');
SELECT cron.schedule('bot-tick-20', '* * * * *', 'SELECT pg_sleep(20); SELECT bot_tick_safe();');
SELECT cron.schedule('bot-tick-30', '* * * * *', 'SELECT pg_sleep(30); SELECT bot_tick_safe();');
SELECT cron.schedule('bot-tick-40', '* * * * *', 'SELECT pg_sleep(40); SELECT bot_tick_safe();');
SELECT cron.schedule('bot-tick-50', '* * * * *', 'SELECT pg_sleep(50); SELECT bot_tick_safe();');
```

Onde `bot_tick_safe()`:
1. Pega `pg_try_advisory_lock(8675309)` (single lock para evitar concorrência)
2. Executa `execute_overdue_bot_bids()` primeiro (insere lances vencidos)
3. Executa `bot_protection_loop()` em seguida (agenda próximos)
4. Libera lock

Resultado: **gap máximo entre lance do usuário e próximo lance do bot cai de ~30-60s para ~10-15s** (5-14s de delay aleatório natural + até 10s de espera pelo próximo tick).

### Mudança 3 — Aumentar safety net para 90s

Em `bot_protection_loop`, alterar `v_seconds_since_last_bid >= 60` para `>= 90`. Isso evita finalizações prematuras quando a distribuição natural de bots tem ocasionalmente delays de 14s + tick de 10s.

### Mudança 4 — Remover os 4 cron jobs antigos

Após criar os 6 novos jobs `bot-tick-*`, dropar:
- `bot-protection-loop-00`
- `bot-protection-loop-30`
- `execute-overdue-bot-bids-00`
- `execute-overdue-bot-bids-30`

### Mudança 5 — Polling local mais frequente em "Verificando" (UI)

Em `src/components/AuctionCard.tsx` linha 116, reduzir `setInterval(forceSync, 5000)` para `2000`. Isso faz o card sair do estado "Verificando" mais rápido após o backend inserir o lance, sem aumentar a carga (apenas 1 SELECT a cada 2s, não invoca edge function).

---

## O que NÃO muda

- Lógica de agendamento de bots (faixas early/middle/late/sniper, anti-repetição) — intacta.
- Regras de finalização (predefined winner, open_win_mode, max_price, revenue_target) — intactas.
- RLS, triggers de bid, payouts, fury vault, afiliados — intactos.
- Hook `useRealTimeProtection` — permanece no-op.
- Edge function `sync-timers-and-protection` — permanece sem ser invocada pelo frontend.
- Nenhuma outra UI/funcionalidade tocada.

---

## Resultado esperado

| Métrica | Antes | Depois |
|---|---|---|
| Frequência efetiva de tick de bot | 30-60s | 10s |
| Gap máximo entre lances de bot | ~30-60s | ~14-24s |
| "Verificando lances válidos" visível | Frequente, longo | Raro, ≤2s |
| Carga no banco | Baixa | Levemente maior (6 jobs/min vs 4), ainda muito segura |
| Risco de sobrecarga retornar | Zero | Zero (mesmo padrão de lock + skip) |

---

## Detalhes técnicos para implementação

**Migration SQL:**
1. Criar função `bot_tick()` que invoca `execute_overdue_bot_bids()` + `bot_protection_loop()` em sequência
2. Criar função `bot_tick_safe()` com `pg_try_advisory_lock(8675309)`
3. Alterar `bot_protection_loop()`: `>= 60` → `>= 90` no safety net
4. `cron.unschedule('bot-protection-loop-00')` + 3 outros antigos
5. `cron.schedule('bot-tick-00', '* * * * *', ...)` + 5 outros com `pg_sleep`

**Arquivo TS:**
- `src/components/AuctionCard.tsx` linha 116: `5000` → `2000`

