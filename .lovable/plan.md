

# Fix: Caixa Financeiro contando contratos Demo como dinheiro real

## Problema

O hook `usePartnerCashflow.ts` busca **todos** os `partner_contracts` sem filtrar `is_demo`. Contas de posicionamento (demo) são incluídas nos aportes iniciais, inflando o valor de entradas e distorcendo o saldo líquido.

## Solução

Filtrar contratos demo em todas as queries relevantes no `usePartnerCashflow.ts`:

### Arquivo: `src/hooks/usePartnerCashflow.ts`

1. **Query de contratos**: adicionar `.eq('is_demo', false)` na busca de `partner_contracts`
2. **Bônus de indicação**: manter todos (bônus de indicação podem existir mesmo com contratos demo na rede, mas os valores de aporte referenciados nos bônus devem refletir apenas contratos reais)
3. **Movimentos recentes**: contratos demo não aparecerão mais como "Aporte Inicial"

A mudança é mínima — adicionar um filtro `.eq('is_demo', false)` na linha da query de contratos. Os upgrades, payouts, withdrawals e referral bonuses são vinculados a contratos, então se o contrato é demo, os payouts já não existem (conforme regra de negócio de que contas demo não geram payouts).

## Impacto

- "Aportes Iniciais" mostrará apenas dinheiro real
- "Total Entradas" e "Saldo Líquido" refletirão valores reais
- Nenhuma alteração na UI, apenas no filtro de dados

