

# Upgrade Manual de Cotas pelo Painel Admin

## Situação Atual

O painel admin (`/admin/parceiros`) permite configurar `max_cotas` nos planos e gerenciar contratos (suspender, reativar, crédito manual), mas **não possui** uma opção para alterar a quantidade de cotas de um contrato ativo. O upgrade de cotas só funciona pelo fluxo do parceiro (pagamento PIX).

## Solução

Adicionar um botão "Upgrade Cotas" na listagem de contratos (ao lado do botão de Crédito Manual), disponível apenas quando o contrato é `ACTIVE` e o plano permite `max_cotas > 1`. Ao clicar, abre um dialog com seletor de novas cotas e recalcula os valores proporcionais.

### Mudanças

**1. `src/hooks/useAdminPartners.ts`**
- Adicionar função `upgradeContractCotas(contractId, newCotas)` que:
  - Busca o plano do contrato para obter valores unitários
  - Calcula novos valores: `aporte_value = plan.aporte_value * newCotas`, `weekly_cap = plan.weekly_cap * newCotas`, `total_cap = plan.total_cap * newCotas`
  - Atualiza o contrato no banco preservando `total_received`
  - Registra no `admin_audit_log`

**2. `src/components/Admin/AdminPartnerManagement.tsx`**
- Adicionar botão "Upgrade Cotas" nos contratos ativos cujo plano tenha `max_cotas > 1`
- Dialog com:
  - Info do contrato atual (plano, cotas atuais)
  - Seletor de novas cotas (de `cotas_atual + 1` até `max_cotas`)
  - Resumo dos novos valores (aporte, teto semanal, teto total)
  - Botão confirmar

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAdminPartners.ts` | Função `upgradeContractCotas` |
| `src/components/Admin/AdminPartnerManagement.tsx` | Botão + Dialog de upgrade de cotas na listagem de contratos |

