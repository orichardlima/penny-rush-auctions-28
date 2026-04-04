

# Formatar Números no Padrão Brasileiro nos Cards do Admin Dashboard

## Problema

Os 4 cards de resumo do painel admin exibem números sem formatação brasileira:
- `1387` → deveria ser `1.387`
- `1018842` → deveria ser `1.018.842`
- `R$ 24873.25` → deveria ser `R$ 24.873,25`

## Solução

### `src/components/AdminDashboard.tsx`

Aplicar `toLocaleString('pt-BR')` nos valores numéricos das 4 linhas:

- **Linha 142** — Usuários Totais: `{totalUsers}` → `{totalUsers.toLocaleString('pt-BR')}`
- **Linha 152** — Total de leilões: `{auctions.length}` → `{auctions.length.toLocaleString('pt-BR')}`
- **Linha 161** — Total de Lances: `{totalBids}` → `{totalBids.toLocaleString('pt-BR')}`
- **Linha 172** — Receita Estimada: usar `formatPrice()` (já importado em `lib/utils.ts`) em vez de `R$ ${value.toFixed(2)}`

### Nenhum outro arquivo alterado

