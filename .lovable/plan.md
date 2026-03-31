

# Fix: Nome "Parceiro" no Nível 3 — contrato do referrer fora do período filtrado

## Problema

O `contractsMap` (linha 146) é construído apenas com contratos **filtrados pelo período**. Quando um bônus de Nível 3 referencia um `referrer_contract_id` cujo contrato foi criado fora do período selecionado, o contrato não está no mapa, e o `user_id` do referrer nunca é coletado para busca de perfil. Resultado: nome cai no fallback "Parceiro".

No banco, todos os bônus Nível 3 têm nomes reais (ex: "Mariano roney lima teles", "Richard Lima").

## Solução

Criar um `allContractsMap` com **todos** os contratos (sem filtro de período) para resolver nomes e lookups de referral. Manter o `contracts` filtrado apenas para cálculos financeiros (aportes, entradas).

### Arquivo: `src/hooks/usePartnerCashflow.ts`

1. Guardar `contractsResult.data` completo em `allContracts` (sem filtro de período)
2. Criar `allContractsMap` a partir de `allContracts`
3. Coletar `user_ids` de `allContracts` (não só dos filtrados) para o `profilesMap`
4. Usar `allContractsMap` em todas as resoluções de nomes (referral bonuses, movements)
5. Manter `contracts` (filtrado) apenas para cálculos de totais financeiros

## Impacto

- Nomes reais aparecem em todos os níveis, independente do filtro de período
- Cálculos financeiros continuam corretos (usam dados filtrados)
- Nenhuma alteração na UI ou no banco

