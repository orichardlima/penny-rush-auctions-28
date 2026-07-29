
# Programa de Expansão por Equipes — Plano de Implementação

Substituição integral do binário. Dado o tamanho (20 seções, DB + backend + frontend admin/parceiro + testes + migração), proponho executar em **6 fases sequenciais**, cada uma entregue e validada antes da próxima. Nada de pagamento financeiro real é ligado até você aprovar percentuais.

## Diagnóstico rápido do que existe hoje

**Tabelas do binário (DB):**
- `partner_binary_positions`, `binary_bonuses`, `binary_cycle_closures`, `binary_points_log`
- Adjacentes: `partner_levels`, `partner_level_points`, `partner_weekly_scores`, `partner_weekly_eligibility`

**Funções DB relevantes:**
- `close_binary_cycle`, `get_binary_tree`, `auto_create_binary_position`, `find_orphan_binary_points`, `calculate_partner_weekly_score`, `upgrade_binary_points_propagation` (trigger)

**Frontend com dependência binária (21 arquivos):**
- Parceiro: `BinaryNetworkTree`, `BinaryBonusHistory`, `PartnerDashboard`, `PartnerPlanCard`, `PartnerReferralSection`, `LeaveSponsorNetwork`
- Admin: `BinaryNetworkManager`, `AdminBinaryTreeView`, `OrphanBinaryPointsPanel`, `TransferSponsorManager`, `PartnerGraduationManager`, `PartnerEvidencePanel`, `AdminNetworkExitsTab`, `PartnerDetailModal`, `AdminPartnerManagement`
- Hooks: `useBinaryNetwork`, `useAdminBinaryCycle`, `useAdminPartners`, `usePartnerReferrals`, `useReferralTracking`

**Preservado (não mexer):** genealogia de patrocínio (`partner_contracts.referrer_id`), afiliados, Fast Start, Central de Performance, saques, Pontos Show, comissões L1/L2/L3.

---

## Fase 1 — Fundação DB + Feature Flags (sem impacto no usuário)

**Migrations:**
1. Criar flags em `system_settings`:
   - `binary_system_enabled = false`
   - `expansion_program_enabled = true`
   - `expansion_bonus_payout_enabled = false`
   - `expansion_career_enabled = true`
   - `expansion_points_generation_enabled = true`
   - `expansion_points_migration_mode = 'start_from_cutoff'`
   - `expansion_cutoff_at` (timestamp)

2. Novas tabelas (public + GRANTs + RLS):
   - `expansion_points_ledger` — lançamentos idempotentes (contract_id, user_id, plan_id, points, source, source_ref UNIQUE, status, reversed_by, created_at)
   - `expansion_team_memberships` — cache derivado: para cada par (ancestor_contract_id, descendant_contract_id) qual é o `team_root_contract_id` (raiz da equipe = 1ª indicação direta no caminho). Índices em ambos os lados.
   - `expansion_period_snapshots` — snapshot semanal por parceiro: pontos organizacionais, por equipe, equipes qualificadas, concentração, graduação computada, valor simulado.
   - `expansion_bonus_lines` — lançamentos do bônus (sempre gravados, marcados como SIMULATED enquanto flag off; PAID quando ligada).
   - `expansion_career_config` (JSONB) — regras por graduação (Bronze→Diamante) e regras de equipe qualificada.
   - `expansion_admin_audit` — log de mudanças (admin, before, after, reason, ip).

3. Marcar tabelas binárias como LEGADO (comentário + revogar INSERT/UPDATE via política; SELECT mantido para auditoria). Não deletar dados.

4. Trigger no `partner_contracts` (ACTIVE): gerar `expansion_points_ledger` com `source_ref = contract_id||':activation'` (idempotente). Igual para upgrades: `source_ref = upgrade_id||':upgrade'`. Reversão em cancelamento.

5. Função `expansion_recompute_team_memberships(contract_id)` — recalcula filiações ao ativar/cancelar/mover contrato.

6. Funções de leitura: `get_expansion_dashboard(user_id)`, `get_expansion_teams(user_id)`, `get_expansion_team_details(user_id, team_root)`, `get_expansion_career_progress(user_id)`, `get_expansion_bonus_preview(user_id, period)`.

**Sem UI ainda.** Backfill dos memberships para contratos ativos existentes (não gera pontos retroativos — respeita `expansion_points_migration_mode`).

## Fase 2 — Motor de Carreira + Bônus (simulado)

- Função `expansion_calculate_period(period_start, period_end)` — para cada parceiro ativo: pontos por equipe, equipes qualificadas, concentração, graduação alcançada/ativa, valor simulado do bônus respeitando teto por plano.
- Cron semanal grava em `expansion_period_snapshots` + `expansion_bonus_lines` (status SIMULATED).
- Enquanto `expansion_bonus_payout_enabled=false`: nenhum lançamento em `partner_payouts` / saldo. Quando ligar: rotina promove SIMULATED→PAID gerando payout real.
- Configuração inicial de graduações e teto semanal (Start R$80 … Diamond R$5.000) via `expansion_career_config`.

## Fase 3 — Novo Escritório do Parceiro

Rotas novas (limpas, sem termos binários):
- `/parceria` (redesign do dashboard) — 6 cards conforme seção 7
- `/parceria/equipes` — lista de equipes diretas + drill-down
- `/parceria/bonus-expansao` — página dedicada ao bônus com quadro "Como seu bônus é formado" e aviso da flag
- `/parceria/carreira` — plano de carreira com progresso por graduação
- `/parceria/pontos-historico` — histórico auditável de Pontos de Expansão

Componentes novos: `ExpansionDashboard`, `MyTeamsList`, `TeamDetailDrawer`, `ExpansionBonusPage`, `CareerPlanPage`, `ExpansionPointsHistory`, `GraduationProgress`, `TeamCard`.

Nada de árvore visual "pirâmide" — usar cards + tabelas expansíveis + gráficos de barra/linha.

## Fase 4 — Novo Painel Admin

- `/admin/expansao` com sub-abas: **Configurações** (pontos por plano, tetos, graduações, equipes qualificadas, concentração, líderes), **Simulações** (rodar cálculo de período sem persistir pagamento), **Ranking de Equipes**, **Concentração por Parceiro**, **Auditoria de Pontos**, **Lançamentos de Bônus** (SIMULATED/PAID), **Ajustes Manuais** (com justificativa obrigatória), **Migração** (mostra preview de `expansion_points_migration_mode`).
- Toda mudança grava em `expansion_admin_audit`.

## Fase 5 — Remoção do Binário da UI

- Remover das rotas/menus: `BinaryNetworkTree`, `BinaryBonusHistory`, `BinaryNetworkManager`, `AdminBinaryTreeView`, `OrphanBinaryPointsPanel`, aba binária de `PartnerDetailModal`, cards binários de `PartnerDashboard`/`PartnerPlanCard`.
- Reescrever textos de `LeaveSponsorNetwork`, `TransferSponsorManager`, `PartnerGraduationManager`, `PartnerEvidencePanel` sem termos binários (a lógica de patrocínio permanece).
- Auditoria textual final: `rg -i "binári|perna|pareamento|left_points|right_points"` no `src/` deve retornar zero em conteúdo visível.
- Contrato v2: novo template + texto do modal de reaceite (seção 16). Enforcement **continua desligado** — só liga com sua aprovação.

## Fase 6 — Testes + Documentação

- Testes SQL (pgTAP-style via edge function ou seeds): os 13 cenários da seção 19.
- Testes frontend (Vitest): componentes chave renderizam sem termos binários.
- Playwright: fluxo parceiro entra em `/parceria` sem qualquer menção binária.
- Documento `docs/expansao/README.md`: como ligar `expansion_bonus_payout_enabled`, rollback (setar flags de volta + reativar rotas binárias — dados preservados), procedimento de migração.

---

## Detalhes técnicos

**Idempotência de pontos:** `expansion_points_ledger.source_ref TEXT UNIQUE`. Webhook/trigger sempre usa `ON CONFLICT DO NOTHING`.

**Reversão:** row nova com `points < 0` + `reverses_id FK`. Nunca UPDATE em linha existente.

**Team root (chave do modelo):** para ancestor A e descendant D, `team_root = ` o filho direto de A no caminho A→…→D. Materializado em `expansion_team_memberships` para consultas O(1). Recalculado sob trigger de mudança de patrocinador (raro; admin-only).

**RLS:** parceiro vê apenas linhas onde `user_id = auth.uid()` ou onde é ancestor via `has_expansion_ancestor(auth.uid(), row.user_id)` (SECURITY DEFINER). Admin via `has_role('admin')`.

**Rollback:** todas as tabelas binárias permanecem. Setar `binary_system_enabled=true` + `expansion_program_enabled=false` + reativar rotas antigas restaura o estado anterior sem migration reversa.

## Pontos que precisam de decisão sua

1. **Data de corte** (`expansion_cutoff_at`) — sugestão: momento em que a Fase 1 for aplicada. Confirma?
2. **Migração de pontos legados:** começa em `start_from_cutoff` (nenhum ponto retroativo). Depois você decide se recalcula contratos ativos via painel.
3. **Percentual/fator financeiro do bônus:** deixo os campos configuráveis, sem valor default operacional. Concorda?
4. **Manter tela de "Rede de Equipe" antiga em modo somente-leitura** por N dias antes de remover do menu? Ou remover imediatamente na Fase 5?

## Ordem de execução

Fase 1 e 2 são pré-requisitos e não têm impacto visível. Posso rodar já.
Fase 3 muda o escritório do parceiro — melhor fazer após você validar Fase 1/2.
Fase 5 (remoção UI) é irreversível visualmente — só executo após seu OK.

Ao aprovar, começo pela **Fase 1 (migrations + flags + tabelas + ledger + backfill de memberships)** e volto com o resultado antes de seguir.
