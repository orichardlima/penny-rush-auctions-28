

## Diagnóstico

O DB está **correto**: `last_bidders = ["Richard Lima", "Richard Lima", "Sueli Cerqueira"]`.

O frontend (`AuctionRealtimeContext.tsx`, linha 237-244) aplica uma "sincronização defensiva" para leilões finalizados que **remove todas as ocorrências do nome do vencedor** e prepende uma única — colapsando `[Richard, Richard, Sueli]` em `[Richard, Sueli]`.

```ts
return [winnerAsBidder, ...baseRecentBidders.filter(name => name !== winnerAsBidder)].slice(0, 3);
```

Essa lógica fazia sentido quando `last_bidders` podia ficar dessincronizado, mas agora o trigger `bids_refresh_last_bidders` já garante fidelidade ao histórico real.

## Correção

Ajustar a sincronização para **só prepender o vencedor se ele ainda não estiver na primeira posição** de `baseRecentBidders`, preservando as duplicatas legítimas.

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx` (linhas 237-244)

```ts
const syncedRecentBidders = (() => {
  if (auctionStatus !== 'finished') return baseRecentBidders;

  const winnerAsBidder = normalizeWinnerForLastBid(winnerNameWithRegion || auction.winner_name);
  if (!winnerAsBidder) return baseRecentBidders;

  // Se o vencedor já está em primeiro, preserva o array como está (com duplicatas legítimas)
  if (baseRecentBidders[0] === winnerAsBidder) {
    return baseRecentBidders.slice(0, 3);
  }

  // Caso contrário (last_bidders dessincronizado), prepende o vencedor
  return [winnerAsBidder, ...baseRecentBidders.filter(name => name !== winnerAsBidder)].slice(0, 3);
})();
```

## Resultado esperado

Card do PS5 passa a exibir os **3 chips**: `Richard Lima · Richard Lima · Sueli Cerqueira`.

### Escopo
- Apenas 1 arquivo, ~5 linhas alteradas.
- Nenhuma mudança de UI, fluxo, timer, lógica de vencedor ou banco.
- Não afeta leilões ativos (mantém comportamento atual).
- Leilões finalizados antigos sem duplicatas continuam exibindo normalmente.

