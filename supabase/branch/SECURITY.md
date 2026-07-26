# Relatório de Segurança — Fase 2 (branch)

## Escopo
Fase 2A (fundação de pontuação) + Fase 2B (loja e resgates).

## Superfície de acesso
- **RLS habilitado em todas as tabelas novas.** Todas as tabelas do
  schema `public` criadas recebem `GRANT` explícito para os papéis
  compatíveis com as políticas.
- Nenhuma coluna sensível (custo interno, notas admin) é lida pelo
  usuário: políticas restringem admin.
- `points_ledger` é append-only via trigger `points_ledger_block_mutations`
  que rejeita `UPDATE`/`DELETE` mesmo para service_role.

## Funções SECURITY DEFINER
Todas usam `SET search_path = public` para bloquear ataques de sequestro
de search_path. `REVOKE ... FROM PUBLIC` aplicado em funções críticas
(`points_settle_auction`, `points_reverse_settlement`, `points_admin_adjust`)
para forçar chamada via service_role/edge functions.

## Idempotência
- `points_ledger.idempotency_key UNIQUE` bloqueia crédito duplo em retries.
- `auction_points_settlements.idempotency_key UNIQUE` impede settlement
  paralelo do mesmo leilão.
- `points_redemptions.idempotency_key UNIQUE` impede resgate duplicado.

## Concorrência
- Wallet e buckets acessados sempre com `SELECT ... FOR UPDATE`.
- Constraints CHECK impedem saldos negativos mesmo em bug de aplicação.
- `stock_available` é coluna GERADA (não gravável), evitando divergência.

## Exclusões obrigatórias de crédito
- vencedor definitivo do leilão (`v_winner`)
- bots (`profiles.is_bot = true`)
- contas de teste (`profiles.is_test_account = true`)
- admins (`public.is_admin_user(user_id) = true`)

## Auditoria
- `points_store_item_price_history` audita mudança de preço em pontos.
- `points_redemption_status_history` registra transições.
- `points_program_settings_audit` (Fase 1) já cobre flags.

## Fraude / abuso
- Aprovação manual obrigatória durante piloto.
- `per_user_limit` por item; `stock_reserved` bloqueia over-selling.
- Reversões nunca deletam settlements — geram `REVERSED` + `SUPERSEDED`.

## Riscos residuais
1. Se `auth.uid()` não estiver definido em contexto (edge functions
   chamadas com service_role sem impersonation), `redeem_create` recusa
   corretamente com `not_authenticated`.
2. Cron de expiração não implementado — flag off; risco de expor UI
   com expiração enganosa. Frontend deve esconder enquanto
   `points_expiration_enabled=false`.
3. `redeem_create` pode reservar pontos e falhar depois em item — a
   função executa dentro de uma transação implícita (função plpgsql),
   então reversão automática ocorre em qualquer `RAISE EXCEPTION`.

## Checklist pré-produção
- [ ] `supabase--linter` sem alertas críticos após aplicar migrations em preview.
- [ ] Testes Deno (`points_phase2a_test.ts`, `points_phase2b_test.ts`) verdes.
- [ ] Todas as flags confirmadas `false` no ambiente alvo antes do release.
- [ ] Revisão manual de RLS + GRANTs com o time.
