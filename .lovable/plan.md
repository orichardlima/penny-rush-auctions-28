

# Marcar Parceiros Inadimplentes (Admin)

## Contexto

Parceiros ativados manualmente pela plataforma sem pagamento confirmado precisam ser identificados. O administrador precisa de um campo para marcar quem de fato não pagou, e o sistema deve restringir benefícios desses parceiros.

## Abordagem

Adicionar um campo `financial_status` na tabela `partner_contracts` com valores: `paid` (padrão), `pending_payment`, `overdue`. O admin pode alterar esse campo manualmente na tabela de contratos. Parceiros marcados como inadimplentes terão restrições visuais e operacionais.

## Fase 1 — Banco de Dados

**Migration:**
- Adicionar coluna `financial_status TEXT NOT NULL DEFAULT 'paid'` na tabela `partner_contracts`
- Adicionar coluna `financial_status_updated_at TIMESTAMPTZ` para rastreamento
- Adicionar coluna `financial_status_note TEXT` para observações do admin

## Fase 2 — Painel Admin (AdminPartnerManagement.tsx)

**Na tabela de contratos:**
- Adicionar indicador visual (badge) na coluna de status: se `financial_status != 'paid'`, mostrar badge "Inadimplente" ou "Pgto Pendente" em vermelho/amarelo
- Adicionar botão de ação para o admin alterar o `financial_status` de cada contrato (dropdown com opções: `paid`, `pending_payment`, `overdue`)
- Campo de observação opcional ao alterar o status

**Nos filtros:**
- Adicionar filtro por `financial_status` (Todos, Pago, Pendente, Inadimplente)

**No PartnerDetailModal:**
- Exibir o `financial_status` atual e nota do admin

## Fase 3 — Hook useAdminPartners

- Incluir `financial_status`, `financial_status_updated_at`, `financial_status_note` na query de contratos
- Adicionar função `updateFinancialStatus(contractId, status, note)` que faz UPDATE no contrato e registra no `admin_audit_log`

## Fase 4 — Restrições no Backend (partner-weekly-payouts)

- Na edge function de repasses semanais, verificar `financial_status`: se for `pending_payment` ou `overdue`, pular o contrato (não gerar repasse)

## Fase 5 — Dashboard do Parceiro (PartnerDashboard)

- Se o contrato do usuário logado tiver `financial_status != 'paid'`, exibir banner de alerta com a mensagem adequada e botão "Pagar agora" (link para pagamento)
- Bloquear ações de saque e ativação de indicados quando inadimplente

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Nova coluna `financial_status` + `financial_status_updated_at` + `financial_status_note` |
| `src/hooks/useAdminPartners.ts` | Incluir campos na query + função `updateFinancialStatus` |
| `src/components/Admin/AdminPartnerManagement.tsx` | Badge, botão de ação, filtro por financial_status |
| `src/components/Admin/PartnerDetailModal.tsx` | Exibir financial_status e nota |
| `supabase/functions/partner-weekly-payouts/index.ts` | Filtrar contratos inadimplentes |
| `src/components/Partner/PartnerDashboard.tsx` | Banner de alerta para inadimplentes |

## Não será alterado

- Nenhum fluxo existente de pagamento, webhook, ou UI de compra de lances
- Nenhuma funcionalidade atual será removida ou modificada

