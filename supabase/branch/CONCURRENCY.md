# Relatório de Concorrência — Fase 2 (branch)

## Modelo de locks
| Recurso | Estratégia |
|---|---|
| Settlement de leilão | `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` reserva a execução; concorrentes recebem `NULL` e retornam o id existente. |
| Buckets de sobra | `SELECT ... FOR UPDATE` por `(user_id, rule_id, campaign_id)` durante o loop. |
| Wallet | `SELECT ... FOR UPDATE` antes de qualquer débito/crédito. |
| Estoque | `SELECT ... FOR UPDATE` em `points_store_items` durante reserva/aprovação. |
| Ledger | Append-only; sem contenda por UPDATE. |

## Cenários testados (Fase 2A)
1. **Settle repetido simultâneo:** dois workers chamam
   `points_settle_auction` para o mesmo leilão. Apenas um insere o
   settlement; o segundo encontra o `idempotency_key` e retorna o mesmo id.
2. **Reservas paralelas:** duas chamadas `points_reserve` para o mesmo
   usuário são serializadas via `FOR UPDATE`; a segunda vê o saldo já
   deduzido e rejeita com `insufficient_points` se necessário.
3. **Reversão durante nova execução:** `points_reverse_settlement`
   marca original como `SUPERSEDED` — settlements futuros usam
   `version = MAX+1`.

## Cenários testados (Fase 2B)
1. **Reserva de estoque concorrente:** dois usuários pedem o último
   item. `FOR UPDATE` garante que o segundo recebe `insufficient_stock`.
2. **Cancelar após aprovar:** bloqueado (`not_pending`).
3. **Aprovar sem saldo reservado:** impossível — `redeem_create`
   sempre chama `points_reserve` no mesmo passo.

## Deadlock risk
Ordem de aquisição de locks é fixa e monotônica:
1. `points_wallets` (por `user_id`).
2. `points_accrual_buckets` (por `(user_id, rule_id, campaign_id)`).
3. `points_store_items` (por `id`, uma linha por vez).

Como funções não misturam a ordem, deadlocks entre `points_settle_auction`
e `redeem_create` são evitados (settle não toca em items;
redeem não toca em buckets).

## Timeouts
`points_settle_auction` de leilões com >10k bids elegíveis deve rodar
via edge function assíncrona; usar `SET LOCAL statement_timeout` fica
a critério do wrapper.
