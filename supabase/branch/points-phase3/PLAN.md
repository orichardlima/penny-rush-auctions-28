# Programa Pontos Show — Fase 3 v2 (correções obrigatórias aplicadas)

> **Entrega exclusivamente em BRANCH.** Nada foi aplicado em produção.
> Nenhuma flag alterada. Nenhuma migration executada. Nenhum webhook
> redeployado. `points_accrual_started_at` continua `NULL`.
> `audience_mode` inexistente em produção.

## Correções aplicadas (relação 1:1 com o briefing)

| # | Item obrigatório | Onde foi corrigido |
|---|---|---|
| 1 | **Separar elegibilidade financeira da audiência** | Nova coluna `bid_lots.payment_eligible_for_points`. Audiência avaliada no bid via `points_user_in_audience()`. `audience_mode='off'` na compra **não** descaracteriza o lote. |
| 2 | **Proibir wallet negativa** | Nova tabela `points_reversal_cases` + trigger `trg_points_wallet_no_negative` (bloqueia `available/reserved/blocked < 0`). `reverse_paid_bid_purchase` calcula `points_recovered` e `points_outstanding`, coloca wallet em `UNDER_REVIEW`. |
| 3 | **Timestamp do pagamento do gateway** | Colunas `gateway_event_id`, `gateway_payload_hash`, `payment_created_at`, `payment_confirmed_at`, `webhook_received_at`, `processed_at` em `bid_lots` e `bid_purchases`. Se `payment_confirmed_at IS NULL` → lote entra `lot_status='pending_reconciliation'` e **não** conta para o programa. |
| 4 | **Ativação atômica** | RPC `points_admin_activate_pilot(rule_id, cutoff, pilot_user_ids, audience_mode)` valida `webhooks_validated`, ativa regra + define corte + define audiência + incrementa versão + liga programa **em uma única transação**. |
| 5 | **Imutabilidade completa de `points_rules`** | Trigger `trg_points_rules_immutable` bloqueia mudança de `rule_code, version, bids_per_point, points_per_block, multiplier, active_from` quando há bids/buckets/ledger vinculados. Trigger `trg_points_rules_no_delete` bloqueia `DELETE`. Índice único garante que reuso de versão é impossível. `active_from` não pode mudar após ativação. |
| 6 | **Segurança do guard do trigger** | GUC `points.canonical_credit_active` só é definido dentro da RPC privada via `set_config(..., true)` (local à transação). Função `points_canonical_credit_active()` lê a GUC no trigger. Verificação pós-op: `new_bids_balance - old_bids_balance = initial_amount` → divergência causa rollback. Frontend não consegue setar. |
| 7 | **Testes obrigatórios** | `points_phase3_test.ts` cobre A/B/D/E/F/G/I/J/K/R/S/T com fixtures descartáveis. Os itens documentais (C/H/L/M/N/O/P/Q) estão marcados como contrato validado por code review — smoke test roda em branch sem tocar produção. |
| 8 | **Código para revisão** | Todos os arquivos SQL, diffs, testes e docs presentes nesta pasta. |

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `003_up.sql` | Migration v2 completa (regra, lotes, RPCs, reversão, ativação, guards) |
| `003_down.sql` | Rollback simétrico |
| `webhooks.diff.md` | Diffs VeoPag/MagenPay (extração de timestamp confiável, hash do payload, pending_reconciliation) |
| `triggers.diff.md` | Diff do trigger legado com GUARD via GUC LOCAL |
| `points_phase3_test.ts` | Smoke test Deno |
| `ROLLBACK.md` | Procedimento de reversão |
| `PLAN.md` | Este documento |

## Invariantes garantidas

1. `bids.eligible_for_points=true` somente quando **todas** as condições
   coexistem: `payment_eligible_for_points=true` no lote consumido,
   `points_program_enabled`, `points_accrual_enabled`,
   `bid.created_at >= points_accrual_started_at`, usuário na audiência **no
   momento do bid**, leilão elegível, regra ativa vigente, usuário não é
   bot/admin/test_account, rastreamento válido. (A checagem é feita pelo
   settlement — `place_bid` grava apenas o `points_rule_id` snapshot.)
2. `payment_eligible_for_points` é permanente e reflete apenas a origem
   financeira: audiência não descaracteriza um lote financeiramente válido.
3. Nenhuma linha de `points_wallets` pode ter `available/reserved/blocked <
   0`. Trigger bloqueia; reversão insuficiente vira `points_reversal_cases`.
4. `now()` **nunca** é fonte de `payment_confirmed_at`.
5. Regra com dependências é 100% imutável e não pode ser deletada.
6. Frontend não consegue disparar `credit_paid_bid_purchase` nem alterar
   GUC de guard: RPCs privadas, `REVOKE` para anon/authenticated.
7. Ativação do piloto é atômica ou não acontece.

## Fora de escopo (permanece bloqueado)

- Ativar qualquer flag em produção.
- Definir `points_accrual_started_at` em produção.
- Redeployar webhooks.
- Ativar regra.
- Alterar `audience_mode` em produção.
- Emitir pontos ou aceitar resgates reais.
