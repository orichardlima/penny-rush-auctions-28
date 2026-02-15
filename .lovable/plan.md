
## Correcao dos Dados Financeiros: Apenas Receita Real

### Problema Identificado

1. **23.037 lances de bots** vindos do webhook externo foram registrados com `cost_paid = 1.00` (em vez de `0`), inflando o `company_revenue` dos leiloes em **R$ 23.037,00**
2. A RPC `get_financial_summary_filtered` usa `company_revenue` diretamente, sem filtrar bots
3. O trigger `update_auction_on_bid` so verifica `cost_paid > 0`, mas nao verifica se o usuario e bot
4. O componente BidAnalytics usa estimativa fixa de 70/30 em vez de dados reais

### Solucao em 4 Etapas

---

### Etapa 1 - Correcao de Dados no Banco (Migration SQL)

**1a) Corrigir os 23.037 lances de bots** que tem `cost_paid = 1.00` para `cost_paid = 0`:

```sql
UPDATE bids SET cost_paid = 0
WHERE user_id IN (SELECT user_id FROM profiles WHERE is_bot = true)
AND cost_paid > 0;
```

**1b) Recalcular `company_revenue` de todos os leiloes** baseado apenas em lances de usuarios reais:

```sql
UPDATE auctions a SET company_revenue = COALESCE(
  (SELECT SUM(b.cost_paid)
   FROM bids b
   JOIN profiles p ON p.user_id = b.user_id
   WHERE b.auction_id = a.id
   AND p.is_bot = false
   AND b.cost_paid > 0), 0
);
```

---

### Etapa 2 - Corrigir o Trigger `update_auction_on_bid`

Atualizar o trigger para verificar se o usuario e bot ANTES de incrementar `company_revenue`, adicionando uma camada extra de seguranca alem do `cost_paid > 0`:

```sql
-- No UPDATE do trigger, mudar a logica de company_revenue:
company_revenue = COALESCE(company_revenue, 0) + 
  CASE WHEN NEW.cost_paid > 0 AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id AND is_bot = true
  ) THEN v_bid_cost ELSE 0 END
```

---

### Etapa 3 - Atualizar a RPC `get_financial_summary_filtered`

Quando `real_only = true`, a RPC deve calcular a receita de leiloes somando `cost_paid` dos lances de usuarios reais (nao bots), em vez de usar o campo `company_revenue` diretamente. Isso garante dupla seguranca:

- **`real_only = false`**: usa `company_revenue` (que agora ja esta corrigido)
- **`real_only = true`**: calcula diretamente da tabela `bids` filtrando `is_bot = false`

Tambem atualizar `average_auction_revenue` para seguir a mesma logica.

---

### Etapa 4 - Corrigir o BidAnalytics no Frontend

**Arquivo:** `src/components/AdminFinancialOverview.tsx`

Substituir a estimativa fixa de 70/30 na aba "Analise de Lances" pelos dados reais do `auctionDetails` ja retornados pelo hook `useFinancialAnalytics` (que usa a RPC `get_auction_financials` que ja calcula user_bids vs bot_bids corretamente).

---

### Resumo das Alteracoes

| Arquivo/Recurso | Alteracao |
|---|---|
| Banco de dados (dados) | Corrigir `cost_paid` dos bots e recalcular `company_revenue` |
| Trigger `update_auction_on_bid` | Adicionar verificacao `is_bot` |
| RPC `get_financial_summary_filtered` | Filtrar bots no modo `real_only` |
| `AdminFinancialOverview.tsx` | Usar dados reais em vez de estimativa 70/30 |
| `useFinancialAnalytics.ts` | Nenhuma alteracao necessaria |

### Resultado Esperado

- **Receita Total Real**: ~R$ 5.544 (R$ 3.978 de leiloes + R$ 1.566 de pacotes) em vez dos R$ 27.500 inflados
- Filtro "So Dados Reais" funcionando corretamente
- Protecao futura contra bots inflarem receita novamente
