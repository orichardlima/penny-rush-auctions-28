

# Otimizar Carregamento dos Leilões — Batch de Queries

## Problema

A `fetchAuctions` faz **1 query individual por leilão finalizado** para buscar o perfil do ganhador (`fetchWinnerProfile`). Com 17 leilões finalizados visíveis, são 17+ round trips ao Supabase antes de renderizar. Isso causa o skeleton prolongado que aparece na screenshot.

Adicionalmente, leilões sem `last_bidders` disparam `fetchRecentBidders` (2 queries cada: bids + profiles).

## Solução

Fazer batch de todas as queries de perfil em uma única chamada, antes de transformar os leilões.

### Mudança no `AuctionRealtimeContext.tsx` — `fetchAuctions`

1. Após buscar os leilões do banco, coletar todos os `winner_id` distintos dos leilões finalizados
2. Fazer **1 única query** para buscar todos os perfis de ganhadores de uma vez: `supabase.from('profiles').select('user_id, full_name, city, state').in('user_id', winnerIds)`
3. Criar um `Map<string, string>` com os nomes formatados
4. Passar esse map para `transformAuctionData` em vez de chamar `fetchWinnerProfile` individualmente

### Detalhes

- `transformAuctionData` recebe um parâmetro opcional `winnerProfilesMap` e usa-o em vez de chamar `fetchWinnerProfile`
- Para updates em tempo real (canal Realtime), o comportamento atual de buscar perfil individual permanece (é apenas 1 query por evento)
- `fetchRecentBidders` como fallback permanece igual (já é raro com `last_bidders` populado)

## Impacto esperado

- De ~18 queries (1 settings + 1 auctions + 17 winner profiles) para **3 queries** (1 settings + 1 auctions + 1 batch profiles)
- Redução de tempo de carregamento de vários segundos para < 1s
- Zero mudança visual ou funcional

## Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/AuctionRealtimeContext.tsx` | Batch winner profiles em `fetchAuctions`; `transformAuctionData` aceita map opcional |

