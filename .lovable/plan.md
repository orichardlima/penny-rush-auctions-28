

# Fix: "Erro ao Carregar Dados Financeiros" no dashboard admin

## Diagnóstico

As funções `get_financial_summary_filtered` e `get_revenue_trends_filtered` fazem multiple scans na tabela `bids` (1.05M rows) com JOINs em `profiles` e filtros por `DATE(created_at)`. Faltam indices cruciais:

- `bids.created_at` (filtro de data em todas as queries)
- `bid_purchases.user_id`, `bid_purchases.payment_status`, `bid_purchases.created_at`
- `profiles.is_bot` (filtro em quase todas as subqueries)

A `get_financial_summary_filtered` tem **~10 subqueries independentes** cada uma fazendo full scan + JOIN, causando timeout.

## Solucao

**1 migration** com:

### Parte 1: Indices adicionais

```sql
CREATE INDEX idx_bids_created_at ON public.bids (created_at);
CREATE INDEX idx_bid_purchases_payment_status ON public.bid_purchases (payment_status, created_at);
CREATE INDEX idx_bid_purchases_user_id ON public.bid_purchases (user_id);
CREATE INDEX idx_profiles_is_bot ON public.profiles (is_bot);
```

### Parte 2: Reescrever `get_financial_summary_filtered` com CTEs

Consolidar as ~10 subqueries repetitivas em CTEs compartilhadas, eliminando scans redundantes. Estrutura:

```sql
WITH filtered_bids AS (
  SELECT b.*, p.is_bot FROM bids b 
  JOIN profiles p ON b.user_id = p.user_id
  WHERE date filters...
),
bid_agg AS (
  SELECT count(*) total, 
    count(*) FILTER (WHERE NOT is_bot) as user_bids,
    count(*) FILTER (WHERE is_bot) as bot_bids,
    sum(cost_paid) FILTER (WHERE NOT is_bot AND cost_paid > 0) as real_revenue
  FROM filtered_bids
),
purchase_agg AS (
  SELECT sum(amount_paid) total, count(DISTINCT user_id) paying
  FROM bid_purchases WHERE payment_status='completed' AND date filters...
)
SELECT ... FROM bid_agg, purchase_agg, ...
```

### Parte 3: Reescrever `get_revenue_trends_filtered` com indice

A query ja esta razoavel mas o `DATE(b.created_at)` impede uso de indice. Alterar para range filter (`b.created_at >= start AND b.created_at < end+1`) para aproveitar o novo indice em `created_at`.

## Impacto

- Dashboard financeiro volta a carregar
- Nenhuma mudanca no frontend
- Performance de timeout para <500ms

## Arquivo

| Tipo | Descricao |
|------|-----------|
| Nova migration SQL | Indices + reescrita de `get_financial_summary_filtered` e `get_revenue_trends_filtered` |

