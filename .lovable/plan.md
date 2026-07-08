# Etapa 4C — Cálculo automático + Painel Admin (modo relatório)

**Premissa inegociável:** `performance_center_enabled=false` continua. Zero diff em `partner-weekly-payouts`, `affiliate_commissions`, sponsor, binário, contratos, `partner_contracts`, `partner_payouts`, `profiles.referred_by_partner_code`. Nenhum parceiro vê nada. Apenas admin e apenas leitura/simulação.

---

## 1. Cron jobs (pg_cron + pg_net)

Criar via **supabase--insert** (contém `anon_key` — não pode virar migration compartilhada). Dois jobs distintos, ambos chamando `recalculate-weekly-scores` com header `x-cron-key: <PERFORMANCE_CRON_SECRET>`:

| jobname | schedule | body | finalidade |
|---|---|---|---|
| `performance-recalc-intraweek` | `*/30 * * * *` | `{}` (usa semana Bahia atual) | atualização contínua do ranking |
| `performance-recalc-weekly-close` | `5 3 * * 1` | `{ "week_start": "<segunda anterior>" }` calculado via `date_trunc('week', (now() AT TIME ZONE 'America/Bahia')::date - interval '1 day')` | fechamento da semana encerrada |

Notas:
- `5 3 * * 1` UTC = 00:05 segunda em America/Bahia (UTC−3, sem DST).
- Antes de criar: `SELECT cron.unschedule(jobname)` idempotente para evitar duplicatas.
- Requer `pg_cron` + `pg_net` habilitados (verificar; se faltar, migration só de `CREATE EXTENSION`).
- `partner-weekly-payouts` **não é tocado**. Não há novo cron para payout.

## 2. Backend (dados)

Nenhuma mudança de schema. Reuso do que já existe:
- `calculate_all_partner_weekly_scores(p_week_start)` popula `partner_weekly_scores` e `partner_weekly_eligibility`.
- Confirmar em execução seca (via curl edge function com `x-cron-key`) que ambas as tabelas recebem linhas para a semana atual.
- Se `calculate_all_partner_weekly_scores` já grava eligibility, ok. Se não grava, criar RPC **read-only** `simulate_partner_weekly_eligibility(p_week_start)` que devolve JSON sem escrever — apenas leitura, sem side-effects em payout.

## 3. Painel Admin (frontend, modo relatório)

Nova rota **`/admin/central-performance`** (somente admin, guardada por `profile.is_admin`, igual a `AdminParceiros.tsx`). Item no menu admin existente.

Componentes (todos read-only, sem mutação):

```
src/pages/AdminCentralPerformance.tsx
src/components/Admin/Performance/
  ├── PerformanceHeader.tsx        (badge "MODO RELATÓRIO", seletor de semana Bahia)
  ├── PerformanceRankingTable.tsx  (ranking por pontos)
  ├── PerformanceKpiCards.tsx      (cliques qualificados, cadastros, compras aprovadas, contratos aprovados)
  ├── PerformanceEligibilityTable.tsx (elegibilidade simulada — quem passaria se center estivesse ativo)
  ├── PerformanceAntiFraudPanel.tsx (últimas linhas de anti_fraud_flags)
  ├── PerformanceAuditPanel.tsx    (últimas linhas de performance_audit_logs + performance_backfill_issues)
  └── PerformanceInconsistencies.tsx (visitantes sem attribution, attribution sem tracking, órfãos)
src/hooks/useAdminPerformance.ts   (fetch centralizado, sem realtime pesado)
```

Fontes de dados (SELECT apenas):
- `partner_weekly_scores`, `partner_weekly_eligibility` — ranking + elegibilidade simulada.
- `tracking_events` agregado — cliques qualificados, dedupe, host_flag.
- `attribution_events` agregado por `conversion_type` — signup, purchase_approved, partner_plan_approved.
- `anti_fraud_flags` — últimos flags, sem ação.
- `performance_audit_logs` — logs recentes.
- `performance_backfill_issues` — pendências.
- Inconsistências: LEFT JOIN queries para detectar attribution sem tracking, tracking sem attribution do mesmo visitor_id, etc.

Regras UI:
- Badge global "MODO RELATÓRIO — sem impacto financeiro" em toda a tela.
- Nenhum botão de ação (sem "aprovar", "pagar", "reverter"). Apenas visualização + export CSV opcional (client-side, sem edge function).
- Semana Bahia: reutilizar helpers de `src/utils/weekHelpers.ts` mas garantindo timezone Bahia (mesma lógica do `bahiaTodayISO`/`toMondayISO` da edge function).

## 4. Parceiro (frontend)

**Nada muda.** Nenhum link, nenhuma tela, nenhum badge. `performance_center_enabled=false` continua governando qualquer exposição futura.

## 5. Fora de escopo (explicitamente)

- Payout real, criação/alteração de `partner_payouts`.
- Chamadas de `partner-weekly-payouts`.
- Alteração de `affiliate_commissions`, `partner_contracts`, `partner_binary_positions`.
- Notificações/e-mails a parceiros.
- Reversão dos registros de teste (test_user_id `26a25ea7…`, tracking `faf7d23b…`, attribution `ca7657b2…`, code `124BB09F`, afiliado Luis Carlos `9634ea5f…`) — permanecem documentados para limpeza pré-ativação.
- Ativação de `performance_center_enabled`.

## 6. Validação após implementação

1. `cron.job` lista os dois jobs ativos; `cron.job_run_details` mostra sucesso após 30min.
2. Curl manual em `recalculate-weekly-scores` com `x-cron-key` → 200 + linhas em `partner_weekly_scores` para semana Bahia atual.
3. Painel admin abre, mostra ranking, KPIs coerentes com evento de teste (Luis Carlos com 5 pontos).
4. Diff-check: `git diff` NÃO toca `partner-weekly-payouts`, `partner_contracts`, `affiliate_commissions`, sponsor, binário.
5. Parceiro logado em `/minha-parceria` não vê absolutamente nada de performance.
6. `performance_center_enabled` continua `false` em `performance_settings`.

## Detalhes técnicos

- **Cron SQL** roda via `supabase--insert` (não migration), pois embute anon_key. Header `x-cron-key` lê do PERFORMANCE_CRON_SECRET já criado na Etapa 3.
- **Timezone:** todo cálculo de semana no cliente/admin usa fórmula Bahia (UTC−3 fixo). Não confiar em `new Date().getDay()` local do browser.
- **Permissões:** todas as tabelas consultadas já têm RLS; o painel usa sessão admin, então basta policies existentes de `is_admin`. Se alguma tabela (`tracking_events`, `attribution_events`, `anti_fraud_flags`, `performance_audit_logs`) não tiver policy admin-read, adicionar **via migration separada apenas com `CREATE POLICY … FOR SELECT TO authenticated USING (public.is_admin(auth.uid()))`** — sem GRANTs novos, sem tocar dados.
- **Bundle:** rota admin com `React.lazy` para não pesar no bundle do parceiro.

Aguardando aprovação para implementar.
