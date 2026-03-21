

# Corrigir lentidão no Painel Administrativo

## Problema identificado

O painel admin está extremamente lento por três razões principais:

### 1. N+1 queries: 410 chamadas individuais ao banco
A função `fetchAuctionDetails` no hook `useFinancialAnalytics` busca **todos os leilões** e depois faz uma chamada RPC individual (`get_auction_financials`) para **cada um** -- são ~410 chamadas paralelas ao Supabase toda vez que o hook é executado.

### 2. Hook duplicado: 3 instâncias simultâneas
O `useFinancialAnalytics()` é instanciado **3 vezes**:
- `AdminDashboard.tsx` (linha 39)
- `AdminFinancialOverview.tsx` (linha 31)  
- `AdvancedAnalytics.tsx` (linha 8)

Cada instância dispara suas próprias 410+ queries. Total: **~1.230 chamadas** ao banco na abertura do painel.

### 3. Todas as abas carregam de uma vez
Os componentes de todas as abas (Pedidos, Parceiros, Afiliados, etc.) iniciam suas queries no mount, mesmo sem estarem visíveis.

## Correção

### Arquivo: `src/hooks/useFinancialAnalytics.ts`
- **Limitar `fetchAuctionDetails`**: Em vez de buscar detalhes de todos os 410 leilões, buscar apenas os 20 mais recentes (são os únicos usados na UI -- `auctionDetails.slice(0, 10)`)
- Adicionar `useRef` para evitar re-fetches desnecessários quando `filters` não muda de fato (o `useEffect` com `[filters]` dispara toda vez que o objeto é recriado)

### Arquivo: `src/components/AdminDashboard.tsx`
- **Remover** a instância de `useFinancialAnalytics()` do AdminDashboard (linha 36-39)
- Usar apenas o `summary?.total_revenue` que já vem dos dados locais de `auctions` para o card de "Receita Estimada", ou passar o summary como prop do componente financeiro
- **Lazy render das abas**: Envolver cada `TabsContent` com renderização condicional -- o conteúdo só monta quando a aba é selecionada pela primeira vez

### Arquivo: `src/components/AdvancedAnalytics.tsx`
- **Receber dados via props** em vez de instanciar seu próprio `useFinancialAnalytics()`
- Aceitar `summary` como prop e remover o hook interno

### Arquivo: `src/components/AdminFinancialOverview.tsx`
- Manter a única instância de `useFinancialAnalytics` aqui (é o componente que realmente usa todos os dados)
- Passar `summary` para cima via callback ou contexto para o card de receita do AdminDashboard

## Resultado esperado

| Antes | Depois |
|---|---|
| ~1.230 queries ao banco | ~25 queries |
| 3 instâncias do hook | 1 instância |
| Todas as abas carregam juntas | Apenas a aba ativa carrega |

