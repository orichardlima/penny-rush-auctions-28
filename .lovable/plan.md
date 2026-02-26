

# Erro ao encerrar leilão: bloqueio por transação longa do `bot_protection_loop`

## Diagnóstico

Os logs do PostgreSQL mostram dezenas de erros **"canceling statement due to statement timeout"**. A causa raiz é a função `bot_protection_loop()`:

- Ela roda como uma **FUNCTION**, que no PostgreSQL executa em **uma única transação**
- O loop de 6 iterações com `pg_sleep(10)` mantém essa transação aberta por **~60 segundos**
- Durante esse tempo, todos os locks adquiridos (INSERTs em `bids` que disparam o trigger `update_auction_on_bid`, UPDATEs em `auctions`) ficam **retidos**
- Quando o admin tenta encerrar manualmente, o `UPDATE auctions SET status = 'finished'` fica **esperando o lock** e atinge o `statement_timeout` padrão (~8s do Supabase)

```text
bot_protection_loop (transação única de 60s)
  ├── iteração 1: INSERT bid → trigger atualiza auction (lock!) → pg_sleep(10)
  ├── iteração 2: INSERT bid → trigger atualiza auction (lock!) → pg_sleep(10)
  ├── ...
  └── iteração 6: INSERT bid → COMMIT (locks liberados)

Admin clica "Encerrar" durante qualquer iteração:
  UPDATE auctions SET status='finished' → ESPERA lock → TIMEOUT ❌
```

Além disso, os thresholds na function do banco ainda estão com os valores **antigos** (5s/8s) — a segunda migration criou a function de novo mas aparentemente não foi aplicada corretamente, ou a primeira migration prevaleceu.

## Solução

Converter `bot_protection_loop` de **FUNCTION** para **PROCEDURE**, que suporta `COMMIT` entre iterações, liberando locks a cada ciclo.

### Migration SQL

1. Dropar a function existente
2. Criar `bot_protection_loop()` como **PROCEDURE** com `COMMIT` após cada iteração
3. Corrigir os thresholds para os valores novos (10s/13s)
4. Atualizar o cron job para usar `CALL public.bot_protection_loop()`

### Mudanças nos thresholds (dentro da mesma migration)

```sql
-- Thresholds corretos (que deveriam estar aplicados)
IF v_seconds_since_last_bid >= 13 THEN
  v_bid_probability := 1.0;   -- timer ~2s
ELSIF v_seconds_since_last_bid >= 10 THEN
  v_bid_probability := 0.25;  -- timer ~5-3s
ELSE
  CONTINUE;                    -- timer > 5s, ignora
END IF;
```

### Mudança no loop (COMMIT entre iterações)

```sql
-- Ao final de cada iteração, antes do pg_sleep:
COMMIT;                    -- libera todos os locks ✅
PERFORM pg_sleep(10);
```

### Resultado

```text
DEPOIS:
  Iteração 1: process + COMMIT (locks liberados) → pg_sleep(10)
  Iteração 2: process + COMMIT (locks liberados) → pg_sleep(10)
  ...
  Admin clica "Encerrar" entre iterações → UPDATE executa imediatamente ✅
```

### Arquivos modificados

- **SQL migration**: substitui function por procedure com COMMIT entre iterações e thresholds corrigidos
- Nenhuma alteração de UI ou outros arquivos

