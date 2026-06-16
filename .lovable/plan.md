# Problema

Os cards continuam em "Verificando lances válidos" porque, na verdade, **os bots pararam de dar lance**:

- Leilão "Galaxy Watch 6": **0 lances** desde que abriu
- Leilão "Micro-ondas 32L": último lance há **6 minutos**

Ou seja: o ajuste de tick/delay anterior não resolve nada se o `bot_tick` em si está falhando.

# Causa raiz (confirmada nos logs do cron)

O `bot_tick_safe()` está caindo com `statement timeout` dentro de um trigger:

```
canceling statement due to statement timeout
PL/pgSQL function rebuild_auction_last_bidders(uuid) line 5
trigger trg_refresh_last_bidders
INSERT INTO bids (...)  -- bot bid
execute_overdue_bot_bids() → bot_tick() → bot_tick_safe()
```

A função `rebuild_auction_last_bidders` roda em **todo INSERT em `bids`** e executa:

```sql
SELECT ... FROM bids b LEFT JOIN profiles p ...
WHERE b.auction_id = X
ORDER BY b.created_at DESC
LIMIT 3
```

A tabela `bids` tem **2.203.891 linhas**. Os índices existentes:

- `idx_bids_auction_id` (auction_id)
- `idx_bids_created_at` (created_at)
- `idx_bids_created_at_user` (created_at DESC, user_id)

**Não existe** índice composto `(auction_id, created_at DESC)`. Para um leilão popular, o Postgres lê todos os bids daquele leilão e ordena em memória, o que estoura o `statement_timeout`. O trigger faz rollback do INSERT do bot → bot nunca dá lance → contador zera → card mostra "Verificando".

Também observado: várias execuções do tick demoram 20-30s (acima da janela de 15s), reforçando que o gargalo é I/O do trigger, não a frequência do cron.

# Plano

## 1. Criar índice composto em `bids` (correção principal)

Migração SQL:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_auction_created_desc
  ON public.bids (auction_id, created_at DESC);
```

Isso transforma o `WHERE auction_id=X ORDER BY created_at DESC LIMIT 3` num index scan O(log n) + 3 fetches, eliminando o timeout do trigger.

Observação: `CREATE INDEX CONCURRENTLY` não pode rodar dentro de transação. A migração vai usar esse modo para não travar inserts em produção.

## 2. Verificação pós-deploy

Após aplicar:

- Conferir `cron.job_run_details` por 5 min — não deve haver mais `status='failed'` por timeout no `bot_tick_safe`.
- Conferir se os 2 leilões ativos voltam a receber lances de bot.
- O card "Verificando lances válidos" deve desaparecer naturalmente.

# Escopo

- **Não mexe** em UI, lógica de leilão, fórmulas de delay, cron jobs ou edge functions.
- **Não altera** o trigger nem a função `rebuild_auction_last_bidders` — apenas dá a ela o índice que faltava.
- Mudança é puramente de infraestrutura de banco. Rollback = `DROP INDEX idx_bids_auction_created_desc;`.
