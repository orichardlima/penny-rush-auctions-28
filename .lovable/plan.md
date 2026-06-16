## Diagnóstico

O leilão **Tablet Galaxy Tab A9+** está recebendo **exatamente 1 lance de bot por minuto** (sempre nos segundos `:00`), enquanto Xbox e Smart TV parecem "saudáveis" só porque têm 30+ lances reais a cada 8 min mantendo o timer vivo. Quando o leilão depende só do bot (caso do Tablet), aparece travado em "Verificando lances válidos" por ~45s a cada minuto.

### Causa raiz: `now()` está congelado dentro de cada execução do cron

Há 12 jobs `bot-tick-XX` rodando como:

```sql
SELECT pg_sleep(N); SELECT public.bot_tick_safe();
```

Cada job roda **em uma única transação**. O `pg_sleep` atrasa o relógio real, mas em PostgreSQL `now()` (= `transaction_timestamp()`) retorna o **início da transação** — não o tempo real. Logo, os 12 jobs por minuto enxergam `now() = HH:MM:00.xxx`, mesmo executando em `:05`, `:10`, … `:55` no relógio real.

Os logs confirmam isso: todas as 12 mensagens `🔄 [BOT-LOOP] Passagem` por minuto mostram timestamp `17:36:00.1xx`, `17:35:00.1xx`, etc. — nunca aparecem em `:05`, `:15`, etc.

### Cascata de efeitos

1. Tick `:00` insere o lance de bot agendado.
2. Trigger `update_auction_on_bid` faz `last_bid_at = NOW()` → também recebe `HH:MM:00`.
3. Ticks `:05`, `:10`, …, `:55` rodam, mas para o Tablet vêem:
   - `last_bid_at = HH:MM:00`
   - `now() = HH:MM:00` (transaction start)
   - `v_seconds_since_last_bid = 0`
   - FASE B exige `secs >= 5` → **nunca agenda** novo lance.
4. Só no `:00` da próxima janela (transação nova, `now()` avança 1 minuto) o ciclo se repete.

Para Xbox/Smart TV o defeito existe igual, mas é mascarado porque lances reais chegando a todo momento (cada um em sua própria transação, com seu próprio `now()` real) mantêm o `last_bid_at` atualizado.

## Correção

Trocar `now()` / `NOW()` por `clock_timestamp()` (que retorna o **tempo real**, não o início da transação) nos pontos críticos da orquestração de bots e no trigger que persiste `last_bid_at`.

### 1. Migração SQL — alterar 3 funções

**`public.update_auction_on_bid()`** (trigger AFTER INSERT em `bids`):
- `last_bid_at = clock_timestamp()`
- `updated_at = clock_timestamp()`

**`public.bot_protection_loop()`**:
- `v_current_time := clock_timestamp();` (em vez de `now()`)
- `UPDATE auctions SET ... last_bid_at = clock_timestamp(), updated_at = clock_timestamp() WHERE status='waiting' ...` (FASE 0)
- Manter o resto da lógica intacta (já usa `v_current_time` localmente).

**`public.execute_overdue_bot_bids()`**:
- Trocar as comparações `<= now()`, `>= now() - interval '5 seconds'` e `>= now() - interval '3 seconds'` por `clock_timestamp()` equivalentes.
- Trocar o `UPDATE ... WHERE ends_at < now() - interval '5 seconds'` por `clock_timestamp()`.

### 2. Nenhuma mudança em UI, RLS, cron, hooks de frontend, ou outras funções

- O `EncerramentoDashboard`, hooks de leilão, edge functions e cron permanecem idênticos.
- Não mexer em `bot_tick`, `bot_tick_safe`, `get_random_bot`, `block_bot_bid_when_target_leading`, nem nas demais triggers (`fury_vault_on_bid`, `bids_refresh_last_bidders`, etc.).
- A semântica de negócio (intervalo de 5–14s entre lances de bot, safety net de 90s, finalização) fica exatamente igual — só passa a respeitar o tempo real.

### 3. Validação após aplicar a migração

Após a migração, esperar 2 minutos e rodar:

```sql
SELECT date_trunc('minute', b.created_at) AS minute, a.title, COUNT(*) AS bot_bids
FROM bids b JOIN auctions a ON a.id=b.auction_id
WHERE b.cost_paid = 0 AND b.created_at > now() - interval '5 minutes' AND a.status='active'
GROUP BY 1, a.title ORDER BY 1 DESC;
```

Esperado: cada leilão ativo "morno" deve passar a receber **4–6 lances de bot por minuto** (a cada 10–15s), em vez de exatamente 1 no segundo `:00`. O badge "Verificando lances válidos" só deve aparecer por 1–2s entre lances.

### Riscos

- Baixíssimos. `clock_timestamp()` é a função padrão do PostgreSQL para "agora de verdade" e é o que o pg_cron + `pg_sleep` exige para funcionar corretamente.
- Nenhuma alteração de schema, RLS, ou contratos externos.
- A finalização de leilão por `safety net` (≥90s sem lance) continua valendo — ainda mais corretamente, porque agora o cálculo de `secs_since_last_bid` reflete o relógio real.
