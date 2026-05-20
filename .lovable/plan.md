## Problema

A aba **Financeiro** mostra "Erro ao Carregar Dados Financeiros / Erro ao carregar resumo financeiro".

Causa identificada nos logs do Postgres: `canceling statement due to statement timeout` na RPC `get_financial_summary_filtered`.

A função faz `JOIN` entre `bids` (~1,34 milhão de linhas) e `profiles` para separar bots de usuários. Quando recebe `start_date = NULL`, faz a varredura completa da tabela e estoura o timeout.

O bug está no estado inicial dos filtros em `src/components/AdminFinancialOverview.tsx`:

```ts
const [filters, setFilters] = useState<FinancialFilters>({
  startDate: null,
  endDate: null,
  realOnly: false,
  revenueType: 'all',
  period: '30d'   // diz 30 dias, mas startDate/endDate vêm nulos
});
```

O período diz "30d" mas as datas vêm `null`, então o hook chama a RPC sem filtro de data e o Postgres tenta agregar todo o histórico.

## Correção

Inicializar `startDate` e `endDate` coerentes com `period: '30d'` (hoje e 30 dias atrás). Assim a primeira carga já usa o índice `idx_bids_created_at` e não estoura timeout.

### Arquivo

- `src/components/AdminFinancialOverview.tsx` — trocar o estado inicial dos filtros para já incluir as datas dos últimos 30 dias (mesma lógica que `FinancialFilters.tsx` aplica quando o usuário clica em "30 dias").

Nenhuma alteração em RPC, banco, UI ou em outros fluxos. O restante da experiência permanece igual; só a primeira chamada deixa de varrer a tabela inteira.

## Observação

Não vou mexer em nada além desse estado inicial — o usuário pediu para não alterar UI ou funcionalidades não relacionadas ao problema.
