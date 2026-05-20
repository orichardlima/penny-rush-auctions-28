## Problema

A aba **Financeiro** mostra "Erro ao Carregar Dados Financeiros" porque duas RPCs do Supabase estão estourando o timeout do Postgres (`57014 canceling statement due to statement timeout`):

- `get_financial_summary_filtered` — faz `bids JOIN profiles` em ~1,34M linhas para contar `user_bids` / `bot_bids`.
- `get_revenue_trends_filtered` — mesmo join para o gráfico diário.

Apesar de já existirem datas padrão (últimos 30 dias), o `JOIN profiles` mais o `COUNT(*) FILTER (...)` continua varrendo a tabela `bids` inteira em alguns planos porque `is_bot` mora em `profiles`, e qualquer queda do índice por data faz o plano cair em seq scan.

Além disso, hoje **qualquer** erro de qualquer RPC esconde TODOS os dados financeiros (cards, tabs, gráficos), mesmo quando outras consultas funcionaram.

## O que será feito

### 1. Causa raiz — tornar as RPCs rápidas
Migration nova que recria as duas funções para:

- Eliminar o `JOIN profiles` no caminho quente. A coluna `is_bot` será desnormalizada dentro de `bids` via nova coluna gerada/coluna materializada **OU**, alternativa mais leve: usar subconsulta `WHERE b.user_id IN (SELECT user_id FROM profiles WHERE is_bot)` apenas no contador de bot, deixando o `total_bids` puro em índice por `created_at`.
- Aplicar `start_date`/`end_date` como `timestamptz` parametrizado para garantir uso do índice `idx_bids_created_at`.
- Em `get_revenue_trends_filtered`, agregar `bids` por dia em uma única passada (`date_trunc('day', created_at)`) usando o mesmo índice e separar a contagem de bot via EXISTS.
- Forçar `SET LOCAL statement_timeout = '20s'` dentro das funções para falhar rápido caso ainda haja gargalo, evitando travar o cliente.

Se necessário, criar índice auxiliar:
```sql
CREATE INDEX IF NOT EXISTS idx_bids_created_at_user
  ON public.bids (created_at DESC, user_id);
```

### 2. Resiliência da UI (fallback)
Em `src/hooks/useFinancialAnalytics.ts`:
- Acompanhar erro por consulta (`summaryError`, `trendsError`, `auctionsError`) em vez de um `error` único global.
- Usar `Promise.allSettled` no `refreshData` para que a falha de uma RPC não derrube as outras.
- Retornar os erros granulares.

Em `src/components/AdminFinancialOverview.tsx`:
- Remover o early return que esconde TUDO quando há erro.
- Mostrar os cards e abas que carregaram com sucesso.
- Exibir um aviso discreto (banner amarelo) apenas nas seções cujo dado falhou (ex.: "Não foi possível carregar a evolução da receita — tente novamente"), com botão de retry usando `refreshData`.

### 3. Validação
- Rodar manualmente as RPCs no SQL Editor com janela 30d para confirmar resposta < 2s.
- Abrir a aba Financeiro e conferir que: (a) os cards aparecem, (b) o gráfico aparece, (c) se eu forçar erro em uma RPC, as outras continuam visíveis.

## Detalhes técnicos

- Sem mudança de UI fora da aba Financeiro.
- Sem mudança nas regras de negócio (receita continua sendo `bids` não-bot com `cost_paid > 0` + `bid_purchases` confirmadas).
- Migrations só recriam funções e, se necessário, adicionam um índice; nenhuma tabela é alterada.
- Tipos do Supabase serão regenerados automaticamente após a migração (assinatura das funções permanece igual).

## Arquivos afetados

- `supabase/migrations/<nova>.sql` (recriação das duas funções + índice opcional)
- `src/hooks/useFinancialAnalytics.ts` (erros granulares + `Promise.allSettled`)
- `src/components/AdminFinancialOverview.tsx` (remover early return; banners por seção)
