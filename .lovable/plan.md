

# Implementacao do Snapshot `last_bidders` na tabela `auctions`

## Objetivo

Eliminar as queries `fetchRecentBidders()` que rodam em cada cliente a cada lance recebido via Realtime. Os ultimos 3 nomes passam a vir diretamente no payload do `UPDATE` de `auctions`, sem nenhum SELECT adicional no frontend.

## Resultado esperado

- Com 500 usuarios simultaneos: **0 queries por lance** (antes: 1.000 queries por lance)
- Nomes dos ultimos 3 participantes continuam aparecendo instantaneamente
- Nenhuma mudanca visual para o usuario

---

## Etapa 1 - Migration SQL

Adicionar coluna e atualizar o trigger existente.

### 1a. Nova coluna

```sql
ALTER TABLE public.auctions 
ADD COLUMN last_bidders jsonb DEFAULT '[]'::jsonb;
```

Formato: `["Ana S.", "Carlos M.", "Julia R."]` -- array de strings simples, sem IDs.

### 1b. Recriar trigger `update_auction_on_bid()`

O trigger atual ja faz: incrementar `total_bids`, `current_price`, `time_left`, `last_bid_at`, `company_revenue`.

A mudanca adiciona apenas a logica de buscar o `full_name` do perfil, formatar como "PrimeiroNome S." e fazer prepend no array `last_bidders`, mantendo maximo 3 itens.

Logica de formatacao (dentro do PL/pgSQL):
- Buscar `full_name` de `profiles` onde `user_id = NEW.user_id`
- Separar por espacos, pegar primeiro nome + inicial do segundo nome com ponto
- Se nao encontrar perfil, usar "Usuario"
- Prepend no array existente e truncar para 3

### 1c. Backfill dos leiloes ativos/waiting

Atualizar os 5 leiloes existentes com os ultimos 3 nomes de cada um, usando subquery em `bids` + `profiles`.

---

## Etapa 2 - Frontend (`AuctionRealtimeContext.tsx`)

### 2a. `updateAuction()` (linha 294-310)

**Remover** a chamada `fetchRecentBidders(auctionId)` e ler `newData.last_bidders` direto do payload Realtime:

```typescript
const recentBidders = Array.isArray(newData.last_bidders) 
  ? newData.last_bidders 
  : [];
```

### 2b. `addAuction()` (linha 313-322)

Mesmo tratamento: ler `newData.last_bidders` em vez de chamar `fetchRecentBidders`.

### 2c. `fetchSingleAuction()` (linha 100-134)

Ler `data.last_bidders` em vez de chamar `fetchRecentBidders`.

### 2d. `transformAuctionData()` (linha 227)

Usar `auction.last_bidders` com fallback para `auction.recentBidders || []`.

### 2e. `fetchAuctions()` (carga inicial, linha 270-277)

Ler `auction.last_bidders` em vez de chamar `fetchRecentBidders` para cada leilao. Fallback com `fetchRecentBidders` apenas se `last_bidders` estiver vazio/null (leiloes antigos).

### 2f. Funcao `fetchRecentBidders`

Manter no codigo como fallback, mas nao sera mais chamada durante operacao normal (apenas na carga inicial de leiloes sem o campo populado).

---

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Migration SQL (nova) | Coluna `last_bidders`, trigger atualizado, backfill |
| `src/contexts/AuctionRealtimeContext.tsx` | Ler `last_bidders` do payload, remover SELECTs redundantes |

## Arquivos NAO modificados

- `src/components/AuctionCard.tsx` -- continua recebendo `recentBidders: string[]`
- `src/pages/Index.tsx` -- sem mudanca
- `src/pages/Auctions.tsx` -- sem mudanca
- Todos os outros componentes, hooks e paginas

