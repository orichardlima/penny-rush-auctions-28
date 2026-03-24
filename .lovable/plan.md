

# Adicionar campos de Cotas na interface administrativa de planos

## Problema
Os campos `max_cotas`, `monthly_return_cap` e `total_return_cap` foram criados no banco de dados mas **não aparecem** nos formulários de criar/editar plano no painel admin. O administrador não consegue configurar cotas pela interface.

## Solucao

Adicionar 3 campos nos dois formularios (criar e editar plano) em `AdminPartnerManagement.tsx`:

### Campos a adicionar

| Campo | Label | Tipo | Default |
|---|---|---|---|
| `max_cotas` | Max Cotas | number (min 1) | 1 |
| `monthly_return_cap` | Cap Mensal (%) | number (step 0.01) | 0.10 |
| `total_return_cap` | Cap Total (%) | number (step 0.01) | 2.0 |

### Mudancas

**`src/components/Admin/AdminPartnerManagement.tsx`**:
1. Adicionar `max_cotas: 1`, `monthly_return_cap: 0.10`, `total_return_cap: 2.0` ao estado `newPlan` (formulario de criacao, ~linha 342-353)
2. Adicionar 3 inputs no formulario de criacao (~linha 970, apos "Pontos Gerados")
3. Adicionar 3 inputs no formulario de edicao (~linha 1142, apos "Pontos Gerados")
4. Exibir resumo calculado: "Com X cotas: Aporte total R$ Y, Teto total R$ Z"
5. Na tabela de planos, exibir badge com `max_cotas` quando > 1

Os campos serao salvos automaticamente pois `updatePlan` e `createPlan` ja gravam todos os campos do objeto no banco.

## Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/components/Admin/AdminPartnerManagement.tsx` | Campos max_cotas, monthly_return_cap, total_return_cap nos forms de criar/editar + badge na listagem |

