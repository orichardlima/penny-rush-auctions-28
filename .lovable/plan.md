

# Admin: Upgrade de plano do parceiro (sem pagamento PIX)

## Objetivo

Adicionar um botão e dialog no painel admin que permita trocar o plano de um contrato ativo para um plano superior, recalculando todos os valores proporcionalmente, sem gerar cobrança PIX.

## Lógica de negócio

- Apenas contratos ACTIVE podem ter upgrade de plano
- O novo plano deve ter `aporte_value` maior que o atual (upgrade, nunca downgrade)
- Cotas são resetadas para 1 ao trocar de plano (ou mantidas se o novo plano suportar)
- Valores recalculados: `aporte_value`, `weekly_cap`, `total_cap` (baseados no novo plano x cotas)
- `total_received` é **preservado** (não zera)
- Bônus de indicação dos uplines são recalculados proporcionalmente ao novo aporte
- Pontos binários extras (diferença) são propagados para a rede
- Registro no audit log

## Alterações

### 1. `src/hooks/useAdminPartners.ts` — nova função `upgradeContractPlan`

Função similar a `upgradeContractCotas`, mas troca o `plan_name` e recalcula valores com base no novo plano:

```
upgradeContractPlan(contractId, newPlanId)
  → Valida contrato ACTIVE
  → Valida novo plano tem aporte > atual
  → Atualiza: plan_name, aporte_value, weekly_cap, total_cap, cotas=1
  → Propaga pontos binários extras
  → Recalcula bônus de indicação
  → Audit log (UPGRADE_PLAN)
```

Expor a função no return do hook.

### 2. `src/components/Admin/AdminPartnerManagement.tsx` — UI do upgrade de plano

- Novo state: `isUpgradePlanOpen`, `selectedContractForPlanUpgrade`, `selectedNewPlanId`
- Novo botão na linha de ações de cada contrato ACTIVE (ícone `Zap` ou `Rocket`, ao lado do botão de upgrade de cotas)
- Novo Dialog com:
  - Info do contrato atual (parceiro, plano, aporte)
  - Select com planos superiores disponíveis (filtra `aporte_value > contrato atual` e `is_active`)
  - Preview dos novos valores (aporte, teto semanal, teto total)
  - Botão "Confirmar Upgrade de Plano"

## Nenhuma alteração de banco necessária

A tabela `partner_contracts` já possui os campos `plan_name`, `aporte_value`, `weekly_cap`, `total_cap`, `cotas` — basta um UPDATE.

