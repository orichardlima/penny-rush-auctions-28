

## Desativar Polling Automatico de 30 Segundos no Dashboard Financeiro

### Problema
O hook `useFinancialAnalytics` possui um `setInterval` que atualiza os dados financeiros a cada 30 segundos. Essa atualizacao automatica nao e necessaria para o painel administrativo.

### Alteracao

**Arquivo:** `src/hooks/useFinancialAnalytics.ts`

- Remover o segundo `useEffect` (linhas ~131-141) que configura o polling de 30 segundos com `setInterval`
- Os dados continuarao sendo carregados normalmente na montagem do componente e quando os filtros mudarem
- O botao de refresh manual (`refreshData`) continuara funcionando normalmente

### O que NAO muda
- Carregamento inicial dos dados
- Atualizacao ao mudar filtros
- Funcao `refreshData` para atualizacao manual
- Nenhuma interface, funcionalidade ou workflow existente

