## Diagnóstico

Sim — os 11 lances do Richard no leilão "Micro-ondas 32L Inox" (id `3787675e…`) foram **registrados** no sistema de pontos, mas todos gravados como **`eligible_for_points = false`** (inelegíveis). Os metadados de rastreio estão corretos:

- `source = 'paid_purchase'`
- `lot_id` apontando para lotes base elegíveis (`eligible_for_points = true`, `source = paid_purchase`)
- `tracking_status = 'tracked'`
- `points_program_active_at_bid = true`, `points_accrual_active_at_bid = true`

Ou seja: o consumo FIFO funcionou (os lotes base foram debitados), mas os bids saíram marcados como inelegíveis, então não contam para o balde de acumulação (12→1).

### Causa raiz

Dentro de `public.place_bid`, o trecho que define elegibilidade é:

```sql
v_in_pilot := (v_pilot ? p_user_id::text);
...
IF v_is_bot OR v_is_admin OR v_is_test OR NOT v_in_pilot OR NOT v_accrual_active_snap THEN
  v_eligible := false;
END IF;
```

O `place_bid` **ignora completamente** o `audience_mode` do programa. Hoje temos:

- `audience_mode = {"mode":"all"}` (todos habilitados)
- `points_pilot_users = []` (lista vazia)

Como a lista de piloto está vazia, `v_in_pilot` é sempre `false` e **todos os bids saem inelegíveis** — não importa quem é o usuário. O programa está ativo e o corte já passou, mas a função nunca marca ninguém como elegível.

Isso explica por que o Richard vê 0/12 mesmo dando lances pagos após o corte.

## Correção proposta

### 1. Ajustar `public.place_bid` para respeitar `audience_mode`

Substituir a checagem `NOT v_in_pilot` por uma função de audiência que suporte os quatro modos já documentados (`all`, `pilot`, `percent`, `admin_only`). Criar helper `public.points_user_in_audience(p_user uuid) returns boolean` que:

- `mode = 'all'` → `true` para qualquer usuário
- `mode = 'admin_only'` → `true` só para admins
- `mode = 'pilot'` → `true` se `user_id` estiver em `points_pilot_users`
- `mode = 'percent'` → `true` se `hashtext(user_id) % 100 < percent`
- fallback (nulo/desconhecido) → `false` (postura segura)

E trocar em `place_bid`:

```sql
-- antes
IF v_is_bot OR v_is_admin OR v_is_test OR NOT v_in_pilot OR NOT v_accrual_active_snap THEN

-- depois
IF v_is_bot OR v_is_admin OR v_is_test
   OR NOT public.points_user_in_audience(p_user_id)
   OR NOT v_accrual_active_snap THEN
```

Bots/admin/test continuam bloqueados como já foi definido.

### 2. Reclassificar os lances já registrados após o corte

Backfill único, apenas para bids que:

- `created_at >= points_accrual_started_at` (2026-07-28 07:57 UTC)
- `source = 'paid_purchase'`
- `lot_id` aponta para lote base (`bid_lots.eligible_for_points = true AND source = 'paid_purchase'`)
- Usuário não é bot/admin/test
- Usuário está na audiência atual (`audience_mode = all` hoje, então todos os reais)
- `eligible_for_points = false` (só corrige o que ficou errado)

Atualizar esses bids para `eligible_for_points = true` e incrementar `points_accrual_buckets.eligible_bids_remaining` do usuário (contando apenas bids de leilões ainda ativos, já que os finalizados serão liquidados pelo settle normal). Para leilões já finalizados nesse intervalo, rodar `points_settle_auction` para gerar os pontos correspondentes.

### 3. Validação

- Rodar novamente `place_bid` de teste (via um lance real do Richard) e confirmar `bids.eligible_for_points = true`.
- Consultar `points_accrual_buckets` e `/meus-pontos` do Richard mostrando os 11 lances contando no progresso (11/12).
- Confirmar que bids de bot continuam saindo com `eligible_for_points = false`.

## Detalhes técnicos

- Migração única com: `CREATE OR REPLACE FUNCTION points_user_in_audience` + `CREATE OR REPLACE FUNCTION place_bid` (mantendo todo o resto da função intacto, só trocando a condição de elegibilidade) + bloco `DO $$ … $$` de backfill idempotente.
- Nenhuma alteração de UI. Nenhuma tabela nova.
- Preserva integralmente a lógica de FIFO, débito de saldo, trigger anti-bot e `commit_bid_lot_consumptions`.
- Postura segura: se `audience_mode` estiver malformado, ninguém vira elegível (fallback `false`).
