

# Creditar diferença de lances no upgrade administrativo de plano

## Situação atual

A função `upgradeContractPlan` em `src/hooks/useAdminPartners.ts` atualiza tetos e propaga pontos, mas ignora o campo `bonus_bids` do plano. O parceiro não recebe os lances extras ao fazer upgrade via admin.

## Alteração

**1 arquivo**: `src/hooks/useAdminPartners.ts` — dentro de `upgradeContractPlan`, após o update do contrato (linha ~1620):

1. Buscar `bonus_bids` do plano antigo e do novo plano (já disponíveis em `newPlan.bonus_bids` e no plano atual via `plans.find`)
2. Calcular diferença: `newPlan.bonus_bids - (oldPlan.bonus_bids * oldCotas)` (considerando cotas anteriores)
3. Se diferença > 0:
   - Incrementar `bids_balance` no `profiles` do parceiro (`+= diferença`)
   - Atualizar `bonus_bids_received` no contrato (`+= diferença`)
4. Incluir lances no audit log (old/new values)

## Lógica

```
oldBids = (oldPlan.bonus_bids || 0) * contract.cotas
newBids = newPlan.bonus_bids || 0  // cotas resetam para 1
extraBids = newBids - oldBids

if (extraBids > 0):
  profiles.bids_balance += extraBids
  partner_contracts.bonus_bids_received += extraBids
```

## Impacto

- Apenas a função de upgrade admin é alterada
- Nenhuma mudança de banco necessária
- Nenhuma mudança na UI

