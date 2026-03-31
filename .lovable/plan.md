

# Filtro por Período no Caixa Financeiro

## Resumo

Adicionar um seletor de período (7 dias, 30 dias, 3 meses, todo o período) no topo do Caixa Financeiro. O filtro será aplicado no frontend, filtrando os dados já carregados por data, sem alterar as queries do banco.

## Como funciona

O hook `usePartnerCashflow` já busca todos os dados de uma vez. O filtro será aplicado no componente `PartnerCashflowDashboard`, recalculando o summary, weeklyFlow e movements com base no período selecionado.

## Arquivos a modificar

| Arquivo | Acao |
|---|---|
| `src/hooks/usePartnerCashflow.ts` | Aceitar parâmetro `period` opcional, filtrar dados por data antes de calcular summary/weekly/movements |
| `src/components/Admin/PartnerCashflowDashboard.tsx` | Adicionar seletor de período no header, passar para o hook |

## Detalhes técnicos

### usePartnerCashflow.ts

1. Aceitar parâmetro `period: '7d' | '30d' | '90d' | 'all'` (default `'all'`)
2. Após buscar todos os dados, calcular `cutoffDate` com base no period
3. Filtrar contracts, upgrades, payouts, withdrawals e referralBonuses por `created_at >= cutoffDate` antes de calcular o summary
4. Ajustar o gráfico semanal para mostrar apenas semanas dentro do período

### PartnerCashflowDashboard.tsx

1. Adicionar `useState<PeriodType>('all')` para o período
2. No header (ao lado do botão Atualizar), renderizar o `PeriodFilter` component que já existe em `src/components/Affiliate/PeriodFilter.tsx`
3. Passar o period para `usePartnerCashflow(period)`

## Nenhuma alteração no banco de dados

