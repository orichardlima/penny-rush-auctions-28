# Fase 2A — Fundação de Pontuação (revisado)

Branch-only. **NÃO aplicar em produção sem aprovação explícita.**

## Correção central acatada
Removidos do plano original:
- `accrue_points_from_bid(bid_id)`
- Trigger `AFTER INSERT ON bids` que credita pontos
- Qualquer crédito antes da finalização definitiva do leilão
- Marcação simples de bids como “contados” sem settlement

Bids continuam apenas registrando snapshots (implementados na Fase 1).
O crédito só ocorre em `points_settle_auction(p_auction_id)`, após a
finalização definitiva do leilão.

## Objetos criados (schema `public`)

### Carteira e extrato
- `points_wallets` — saldos segregados (available/reserved/blocked/expired),
  lifetime totals, status (`NORMAL|UNDER_REVIEW|BLOCKED|SUSPENDED|CLOSED`),
  constraints impedindo negativos.
- `points_ledger` — append-only, imutável (trigger bloqueia UPDATE/DELETE),
  enum `points_ledger_type` com todos os tipos exigidos, `idempotency_key`
  UNIQUE.

### Regras e sobras
- `points_rules` — versionadas (`bids_per_point`, `multiplier`, `active_from`,
  `active_to`, `campaign_id`, `is_active`). Snapshot do id vai em cada bid
  (coluna `points_rule_id` já criada na Fase 1).
- `points_accrual_buckets` — sobra por `(user_id, rule_id, campaign_id)`,
  UNIQUE composto.

### Settlements
- `auction_points_settlements` — status
  `PENDING|PROCESSING|COMPLETED|FAILED|REVERSED|SUPERSEDED`, `version`,
  `idempotency_key`, `winner_id`, `reason`, `metadata`.
- `auction_points_settlement_items` — um registro por
  `(settlement_id, user_id, rule_id, campaign_id)` com
  `eligible_bids_count`, `carryover_before/after`, `points_awarded`,
  `ledger_id`.

### Função canônica
- `points_settle_auction(p_auction_id uuid, p_actor uuid default null,
  p_reason text default null) returns uuid` — SECURITY DEFINER,
  `set search_path=public`. Fluxo idempotente conforme especificação
  (17 passos). Só executa se `is_auction_final_for_points(p_auction_id)`
  retornar true. Excluído: vencedor, bots, admins, contas de teste
  (`profiles.is_test_account = true`). Agrupa por `points_rule_id`,
  aplica `points_multiplier_snapshot`, soma com `points_accrual_buckets`,
  emite `EARN_AUCTION` no ledger, atualiza wallet dentro de uma única
  transação com `SELECT ... FOR UPDATE` nos buckets afetados.
- `points_reverse_settlement(p_settlement_id uuid, p_reason text)` —
  gera settlement `REVERSED` + itens compensatórios + ledger
  `ORDER_REVERSAL`. Marca original como `SUPERSEDED`.
- `is_auction_final_for_points(p_auction_id uuid) returns boolean` —
  canônica; leilão `finished`, não cancelado, `finalized_at` presente.

### Wallet helpers
- `points_reserve(user_id, amount, redemption_id, idempotency_key)`
- `points_confirm_reservation(...)`
- `points_release_reservation(...)`
- `points_admin_adjust(user_id, delta, reason, admin_id, idempotency_key)`

Todos SECURITY DEFINER, `search_path=public`, com validações de saldo
e emissão de ledger.

## Flags (defaults)
Todos permanecem `false` / `NULL`:
```
points_program_enabled=false
points_accrual_enabled=false
points_lot_consumption_enabled=false
points_store_enabled=false
points_redemption_enabled=false
points_expiration_enabled=false
points_plus_pix_enabled=false
points_auto_processing_enabled=false
points_accrual_started_at=NULL
```
`points_settle_auction` valida `points_program_enabled AND points_accrual_enabled`
e recusa execução silenciosa quando desligado (retorna settlement `FAILED`
com `reason='program_disabled'` — não credita nada).

## RLS
- `points_wallets`: SELECT `user_id = auth.uid()` OR admin.
- `points_ledger`: SELECT próprio OR admin; INSERT apenas via SECURITY DEFINER
  (revogado do public).
- `points_rules`, `points_accrual_buckets`, settlements e items: SELECT admin;
  usuário lê apenas seus items via view `v_my_points_activity`.

## Idempotência e concorrência
- `points_settle_auction` usa `INSERT ... ON CONFLICT (idempotency_key)
  DO NOTHING RETURNING id` para reserva do settlement; execuções
  concorrentes vêem `PROCESSING` e abortam com `SKIPPED`.
- `points_reserve` / `confirm` / `release` usam `SELECT ... FOR UPDATE`
  em `points_wallets`.
- Ledger `idempotency_key` UNIQUE evita crédito duplo em retries.

## Entregáveis
- `002a_points_foundation_up.sql`
- `002a_points_foundation_down.sql`
- `points_phase2a_test.ts`
- `SECURITY.md`, `CONCURRENCY.md`, `BENCHMARKS.md` (compartilhados na raiz da branch)
