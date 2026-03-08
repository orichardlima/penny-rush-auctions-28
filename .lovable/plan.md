

## Plano: Remover leilões finalizados com 0 lances de todo o site

### Problema
A correção anterior foi aplicada apenas no `useAuctionData.ts`, que **não é mais usado** nas páginas públicas. O feed real vem do `AuctionRealtimeContext.tsx`, que ainda não tem o filtro `total_bids.gt.0`. Leilões com 0 lances continuam aparecendo na Home, na página de Leilões, e potencialmente no admin.

### Alterações

**1. `src/contexts/AuctionRealtimeContext.tsx`** (linha 262)
Adicionar `total_bids.gt.0` ao filtro de leilões finalizados, igualando ao que já foi feito no `useAuctionData.ts`:

```
// De:
query = query.or(`status.in.(active,waiting),and(status.eq.finished,finished_at.gte.${cutoffTime},is_hidden.eq.false)`);

// Para:
query = query.or(`status.in.(active,waiting),and(status.eq.finished,finished_at.gte.${cutoffTime},is_hidden.eq.false,total_bids.gt.0)`);
```

**2. `src/hooks/useRecentWinners.ts`** (linha 28-43)
Adicionar `.gt('total_bids', 0)` à query de vencedores recentes para não exibir "ganhadores" de leilões sem lances.

**3. `src/components/AdminDashboard.tsx`**
No painel admin, manter os leilões com 0 lances visíveis mas adicionar indicação visual (badge) para que admins identifiquem leilões "fantasma". Isso já é informação útil para gestão.

Nenhuma mudança de banco, schema ou edge functions necessária.

