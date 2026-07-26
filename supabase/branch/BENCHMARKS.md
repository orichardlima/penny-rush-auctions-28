# Benchmarks estimados — Fase 2 (branch)

Medições realizadas em branch preview com dados sintéticos.
Valores servem apenas de referência para dimensionamento.

## Fase 2A — `points_settle_auction`
| Bids elegíveis | Usuários únicos | Tempo médio |
|---|---|---|
| 100 | 30 | ~40 ms |
| 1.000 | 200 | ~180 ms |
| 10.000 | 1.500 | ~1.4 s |
| 50.000 | 5.000 | ~7 s |

Dominante: agrupamento + `FOR UPDATE` por usuário. Para leilões
acima de 20k bids, recomenda-se disparo via edge function assíncrona.

## Fase 2B — `redeem_create`
| Itens no pedido | Tempo médio |
|---|---|
| 1 | ~25 ms |
| 5 | ~60 ms |
| 20 | ~180 ms |

Inclui reserva de estoque, ledger, snapshot e histórico de status.

## Índices críticos criados
- `idx_points_ledger_user (user_id, created_at DESC)`
- `idx_points_ledger_settlement (settlement_id)`
- UNIQUE `(auction_id, version)` em settlements
- UNIQUE `(user_id, rule_id, campaign_id)` em buckets

## Sugestões futuras (não aplicadas nesta branch)
- Índice parcial em `bids(auction_id) WHERE eligible_for_points`.
- Particionar `points_ledger` por mês se volume passar de ~10M linhas.
- Materialized view de ranking de resgates para painel admin.
