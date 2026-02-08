

## Correcao: Excluir lances de bot do faturamento (company_revenue)

### Problema

A imagem mostra o leilao "Relogio Mi Band 10" com **"Receita Real: R$ 901,00"** e **"Meta de Receita: 100.1%"**, mas o leilao teve apenas **7 lances reais** (0.7% do total). Os outros 1.078 lances foram de bots. A receita real deveria ser R$ 7,00, nao R$ 901,00.

O leilao foi encerrado prematuramente porque o sistema contabilizou lances de bot como receita.

### Causa raiz

Tres pontos do sistema tratam `company_revenue` incorretamente:

1. **Trigger SQL `update_auction_on_bid()`** -- soma `v_bid_cost` ao `company_revenue` para todos os lances, incluindo bots (`cost_paid = 0`). Deveria somar apenas quando `NEW.cost_paid > 0`.

2. **Funcao SQL `get_auction_financials()`** -- retorna `a.company_revenue as real_revenue`, exibindo o valor inflado como "Receita Real" no painel admin. Deveria calcular a receita real somando apenas `cost_paid > 0` da tabela `bids`.

3. **Bots legados com `cost_paid = 1.00`** -- um procedimento antigo (`auto_bid_system_procedure`) inseria bids de bot com `cost_paid = bid_cost` em vez de `cost_paid = 0`. Esses 1.015 bots legados tambem inflaram o `company_revenue`.

### Solucao

Uma unica migration SQL que corrige os 3 problemas de uma vez:

---

#### 1. Corrigir o trigger `update_auction_on_bid()`

Alterar a linha de atualizacao do `company_revenue` de:

```text
company_revenue = COALESCE(company_revenue, 0) + v_bid_cost,
```

Para:

```text
company_revenue = COALESCE(company_revenue, 0) + CASE WHEN NEW.cost_paid > 0 THEN v_bid_cost ELSE 0 END,
```

Isso garante que apenas lances pagos (usuarios reais) incrementem a receita. Bots (`cost_paid = 0`) continuam normalmente em tudo o mais: preco, total_bids, last_bidders, time_left.

---

#### 2. Corrigir bids legados de bots com `cost_paid = 1.00`

Atualizar os bids de bots que foram inseridos incorretamente com `cost_paid > 0`:

```text
UPDATE public.bids b
SET cost_paid = 0
FROM public.profiles p
WHERE b.user_id = p.user_id
AND p.is_bot = true
AND b.cost_paid > 0;
```

Isso normaliza todos os dados historicos.

---

#### 3. Recalcular `company_revenue` de TODOS os leiloes

Apos corrigir os bids, recalcular a receita real de todos os leiloes baseando-se na soma de `cost_paid` dos bids reais:

```text
UPDATE public.auctions a
SET company_revenue = COALESCE(sub.real_revenue, 0)
FROM (
  SELECT auction_id, SUM(cost_paid) as real_revenue
  FROM public.bids
  WHERE cost_paid > 0
  GROUP BY auction_id
) sub
WHERE a.id = sub.auction_id;
```

E zerar o `company_revenue` de leiloes que nao tiveram nenhum bid pago:

```text
UPDATE public.auctions
SET company_revenue = 0
WHERE id NOT IN (
  SELECT DISTINCT auction_id FROM public.bids WHERE cost_paid > 0
);
```

---

#### 4. Atualizar funcao `get_auction_financials()` (proteção adicional)

Alterar a funcao para calcular `real_revenue` diretamente da soma de `cost_paid` da tabela `bids` (em vez de usar `company_revenue`), como camada de seguranca:

```text
COALESCE(user_stats.user_revenue, 0) as real_revenue,
```

Usando o `user_revenue` que ja e calculado no LEFT JOIN existente (`SUM(b.cost_paid) as user_revenue`), mas que nao estava sendo aproveitado.

---

### O que NAO muda

- Nenhum componente de UI e alterado
- Nenhum arquivo TypeScript/React e modificado
- O sistema de bots continua funcionando (lances aparecem, reaquecendo leiloes)
- `total_bids` continua contando todos os lances (reais + bots)
- As edge functions `sync-timers-and-protection` e `auction-protection` continuam usando `company_revenue >= revenue_target`, que agora tera o valor correto
- O campo `last_bidders` e formatacao de nomes permanecem identicos

### Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| Nova migration SQL | Corrigir trigger, limpar bids legados, recalcular receitas, atualizar funcao |

### Riscos e consideracoes

- Leiloes ja finalizados terao seu `company_revenue` corrigido retroativamente. Isso e desejavel para relatorios financeiros precisos.
- Leiloes ativos que estejam proximo da meta real podem demorar mais para encerrar, pois a meta agora sera calculada corretamente. Isso e o comportamento esperado.
- A correcao dos bids legados (`cost_paid = 0`) e irreversivel, mas e o valor correto -- bots nao pagam.

