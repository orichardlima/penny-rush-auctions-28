

## Ajuste do Dashboard Financeiro: Separacao Clara de Receitas

### Problema Atual
O card "Receita Total" soma `auction_revenue + package_revenue`, o que gera dupla contagem:
- **Receita de Pacotes** = dinheiro real que entrou (usuario comprou pacote de lances)
- **Receita de Leiloes** = valor dos lances consumidos nos leiloes (mesmos lances que foram comprados nos pacotes)

Somar os dois conta o mesmo dinheiro duas vezes.

### Solucao

Ajustar os cards do `FinancialSummaryCards` para apresentar 3 metricas distintas e claras:

| Card | O que mostra | Fonte |
|---|---|---|
| **Receita Real (Caixa)** | Apenas pagamentos confirmados de pacotes de lances | `package_revenue` da RPC |
| **Lances Consumidos** | Valor dos lances gastos em leiloes por usuarios reais | `auction_revenue` da RPC |
| **Receita Total** | Igual a Receita Real (sem dupla contagem) | `package_revenue` apenas |

---

### Detalhes Tecnicos

#### 1. Alterar `FinancialSummaryCards.tsx`

Reorganizar os cards:

- **Card 1: "Receita Real (Caixa)"** - Mostrar `package_revenue` com icone DollarSign verde e descricao "Pagamentos confirmados de pacotes"
- **Card 2: "Lances Consumidos"** - Mostrar `auction_revenue` com icone Activity azul e descricao "Valor de lances usados em leiloes" (informativo, nao soma na receita)
- **Card 3: "Media por Leilao"** - Manter como esta
- Demais cards permanecem inalterados

A mudanca principal e que "Receita Total" agora mostra apenas `package_revenue` (receita real de caixa), e o antigo "Receita de Leiloes" vira "Lances Consumidos" (metrica informativa).

#### 2. Alterar `AdminFinancialOverview.tsx`

No card executivo "Receita Total" (o primeiro card com borda verde), tambem ajustar para mostrar `package_revenue` como receita real, e mudar a descricao de "Leiloes + Pacotes de Lances" para "Pagamentos confirmados".

#### Nenhuma alteracao no banco de dados
A RPC ja retorna `auction_revenue` e `package_revenue` separadamente. Apenas a apresentacao no frontend sera ajustada.

### Resultado Esperado
- O dashboard mostra claramente que a receita real e apenas o dinheiro dos pacotes (~R$ 1.566)
- O valor de lances consumidos (~R$ 3.978) aparece como metrica informativa separada
- Nenhuma dupla contagem no total
- Todas as demais funcionalidades permanecem inalteradas
