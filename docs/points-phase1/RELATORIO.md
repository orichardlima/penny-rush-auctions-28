# Programa Pontos Show — Fase 1 v3 — Relatório de entrega em branch

**Status:** Entregue em branch. **Nenhum artefato foi aplicado em produção.**

## 1. Arquivos entregues

| Arquivo | Descrição |
|---|---|
| `supabase/branch/points-phase1/001_up.sql` | Migration completa (tabelas, colunas, RLS, RPCs, `place_bid`, `place_bid_as`). |
| `supabase/branch/points-phase1/001_down.sql` | Rollback: DROP puro + restauração do `place_bid` original. |
| `supabase/branch/points-phase1/place_bid.diff.md` | Diff unificado do `place_bid` (baseline vs nova). |
| `supabase/functions/_tests/points_phase1_test.ts` | Testes Deno dos cenários. |
| `src/pages/AdminPontosLoja.tsx` | Página admin `/admin/pontos-loja` — só leitura de flags nesta fase. |

## 2. Auditoria de triggers em `public.bids`

Executada em prod via `pg_trigger`. Resultado:

- **BEFORE INSERT:** `tr_prevent_invalid_bids`, `trg_block_bot_when_target_leading`
- **AFTER  INSERT:** `bids_refresh_last_bidders`, `fury_vault_bid_trigger`, `update_auction_on_bid`, `trg_cancel_scheduled_on_real_bid`
- **AFTER  UPDATE:** *(nenhum)*

Como não há trigger de UPDATE, o `INSERT` canônico já traz todos os snapshots. Nenhum trigger é disparado uma segunda vez.

## 3. Confirmações obrigatórias

- [x] Nenhuma flag foi ativada — todos os `points_program_settings_bool` estão `false`.
- [x] `points_accrual_started_at = NULL`.
- [x] Nenhum saldo em `profiles.bids_balance` foi tocado.
- [x] Nenhum lote em `bid_lots` foi alterado; a coluna nova `eligible_for_points` entra com default `false`, tornando **todos os lotes existentes automaticamente não-elegíveis** sem UPDATE.
- [x] Nenhum bid histórico foi alterado; `tracking_status` entra com default `'pre_cutoff'`.
- [x] Nenhum ponto foi emitido (Fase 1 não emite pontos por design).
- [x] `expire_bid_lots` e `consume_bid_lots` originais permanecem inalterados.
- [x] Webhooks (VeoPag/MagenPay/etc.) permanecem inalterados — Fase 2.

## 4. Gate de pré-requisitos no painel admin

O botão "Ativar acúmulo" só se torna clicável quando:

```
points_accrual_started_at IS NOT NULL
AND points_lot_consumption_enabled = true
AND webhooks_validated = true
AND audience_configured = true
```

Enquanto qualquer um falhar, o painel lista o item ausente.

## 5. Próximos passos (aguardando aprovação)

1. Você revisa este pacote em branch.
2. Autoriza execução dos testes Deno via `supabase--test_edge_functions` (também em branch).
3. Após relatório dos testes aprovado, autoriza deploy da migration em prod.
4. Só então iniciamos a Fase 2 (webhooks / lotes pagos).
