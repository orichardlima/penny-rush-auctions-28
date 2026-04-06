

# Fix: "Erro ao carregar dados do usuário" no painel admin

## Diagnóstico

A função SQL `get_user_analytics` executa **8 subqueries correlacionadas** na tabela `bids` (1.043.487 registros), e **não existe nenhum índice em `bids.user_id`**. Cada subquery faz um sequential scan completo, resultando em statement timeout.

## Solução

**1 migration** com duas partes:

### Parte 1: Criar índices na tabela `bids`

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_user_id 
  ON public.bids (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_auction_id 
  ON public.bids (auction_id);
```

Esses índices transformam as 8 subqueries de sequential scans (~1M rows cada) em index scans (~poucos rows cada), reduzindo o tempo de execução de timeout para <100ms.

### Parte 2: Reescrever `get_user_analytics` com CTE única

Substituir as 8 subqueries independentes por uma única CTE agregada:

```sql
CREATE OR REPLACE FUNCTION public.get_user_analytics(user_uuid uuid)
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  WITH bid_stats AS (
    SELECT 
      COALESCE(SUM(cost_paid), 0) as total_spent,
      COUNT(*)::integer as total_bids,
      COUNT(DISTINCT auction_id)::integer as auctions_participated,
      COALESCE(AVG(cost_paid), 0) as avg_bid_cost,
      MIN(created_at) as first_activity,
      MAX(created_at) as last_activity
    FROM public.bids WHERE user_id = user_uuid
  ),
  ...
  SELECT p.*, bid_stats.*, ...
  FROM profiles p, bid_stats, ...
  WHERE p.user_id = user_uuid;
END;
$$;
```

Isso reduz de 8 scans para 1 scan (com índice: 1 index lookup).

## Impacto

- A tela de detalhes do usuário no admin voltará a carregar normalmente
- Nenhuma mudança no frontend
- Sem impacto em outras funcionalidades

## Arquivo

| Tipo | Descrição |
|------|-----------|
| Nova migration SQL | Cria índices + reescreve `get_user_analytics` com CTE |

