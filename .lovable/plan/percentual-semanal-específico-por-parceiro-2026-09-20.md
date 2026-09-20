# Percentual semanal específico por parceiro

Hoje o percentual configurado na tela "Configurar Faturamento Diário" vale para todos os contratos ativos. A ideia é permitir exceções: alguns parceiros passam a ter um percentual semanal próprio, fixo, que substitui o percentual geral.

## Como vai funcionar

- Na área administrativa do parceiro, o admin define um **percentual semanal específico** (ex.: 1,2%).
- Esse percentual vale **permanentemente**, em todas as semanas, até o admin remover ou desativar.
- A exceção é do **parceiro**: se ele tiver mais de um contrato ativo, todos usam o percentual especial.
- O cálculo continua respeitando **os dois tetos**: o teto semanal do contrato e o teto total do contrato. Nunca paga acima disso.
- Parceiros sem exceção continuam exatamente como hoje, somando os percentuais diários da semana.
- A Central de Anúncios/Performance continua sendo aplicada igual (100% ou 40%), inclusive para quem tem exceção.
- O registro do repasse guarda que veio de uma regra específica, para auditoria.

## O que o admin vai ver

- No cadastro/detalhe do parceiro: campo "Percentual semanal específico (%)", com opção de ativar/desativar e um campo de observação (motivo).
- Na lista de parceiros e no detalhe, um selo indicando que aquele parceiro tem percentual diferenciado.
- Uma tela/aba de exceções listando todos os parceiros com percentual específico, para conferência rápida.
- Histórico de quem alterou e quando.

## Detalhes técnicos

- Nova tabela `partner_revenue_overrides`: `user_id`, `weekly_percentage`, `is_active`, `note`, `created_by`, `created_at`, `updated_at` (único por `user_id`). GRANTs para `authenticated` (leitura do próprio, via política) e `service_role`; políticas restritas a admin para escrita/leitura geral.
- Tabela de auditoria `partner_revenue_override_audit` (ou reuso de `admin_audit_log`) registrando valor anterior/novo.
- `supabase/functions/partner-weekly-payouts/index.ts`: antes de somar `daily_revenue_config`, buscar overrides ativos; para contratos cujo `user_id` tenha override, usar `weekly_percentage` no lugar de `totalPercentage`, mantendo pró-rata proporcional aos dias elegíveis da semana (dias elegíveis ÷ 7) quando o contrato começou no meio da semana. Demais etapas (teto semanal, teto total, multiplicador da Central) inalteradas. Gravar `description`/campo indicando `override` no payout.
- Prévia administrativa (`useDailyPayoutPreview` / `DailyPayoutPreview`) passa a considerar os overrides para não divergir do valor real.
- Hook novo `usePartnerRevenueOverride` + UI no `PartnerDetailModal` / `AdminPartnerManagement`, seguindo os padrões existentes.
- Nenhuma alteração no fluxo atual de configuração geral; nenhuma mudança para parceiros sem exceção.
