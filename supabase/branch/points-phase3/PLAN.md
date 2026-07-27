# Programa Pontos Show — Fase 3 (Regra versionada + corte por pagamento + idempotência)

> **Entrega exclusivamente em BRANCH.** Nada foi aplicado em produção. Nenhuma
> flag foi alterada. Nenhuma migration foi executada. Nenhum webhook em
> produção foi redeployado. `points_accrual_started_at` continua `NULL`.
> `audience_mode` inexistente em produção — será criado apenas por esta branch
> quando você autorizar.

## Escopo desta branch (itens 1, 2, 3, 4, 5, 6 do briefing)

1. `points_rules` — regra canônica versionada e imutável.
2. Corte por **data de confirmação do pagamento** (não `now()`).
3. Idempotência canônica com chave composta.
4. Fluxo canônico único de crédito via RPC `credit_paid_bid_purchase`.
5. `audience_mode` / `audience_version` explícitos.
6. Cancelamento / estorno / chargeback com ledger compensatório.

## Arquivos entregues

| Arquivo | Conteúdo |
|---|---|
| `003_up.sql` | Migration completa (idempotente, gates, sem side-effect operacional) |
| `003_down.sql` | Rollback simétrico |
| `webhooks.diff.md` | Diff textual dos webhooks VeoPag e MagenPay |
| `credit_paid_bid_purchase.sql` | Fonte isolada da RPC (também incluída na migration) |
| `triggers.diff.md` | Diff do `trg_sync_bid_lots` / `sync_bid_lots_on_profile_update` |
| `points_phase3_test.ts` | Smoke test Deno — Camada A + Camada B (mock) |
| `ROLLBACK.md` | Procedimento de reversão passo a passo |

## Invariantes (verificadas nos testes)

- Nenhum lote se torna utilizável enquanto `audience_mode='off'`.
- Nenhum bid recebe `eligible_for_points=true` sem `points_rule_id` da regra ATIVA no momento do bid.
- Regra com bids vinculados é imutável (trigger bloqueia UPDATE em colunas materiais).
- Webhook repetido não incrementa `bids_balance` nem cria novo lote — retorna o lote existente.
- Trigger `trg_sync_bid_lots` **não cria** `source='unknown'` quando o `bid_purchase` já foi creditado pela RPC canônica (marcador `credited_via_canonical_rpc=true`).
- Estorno de lote parcialmente utilizado NÃO altera `bids` históricos: apenas marca `disputed`, bloqueia settlements pendentes e cria ocorrência.
- Ledger é append-only: reversões são novos lançamentos negativos, nunca UPDATE/DELETE.

## O que NÃO está nesta branch (fora de escopo até nova autorização)

- Ativação de qualquer flag.
- Definição de `points_accrual_started_at`.
- Cadastro de itens da loja.
- Execução em produção.
- Alteração de webhooks em produção (apenas diff em branch).
