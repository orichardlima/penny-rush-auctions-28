

## Correção: Sincronizar `last_bidders` no `useFinishAuction.ts`

### Problema residual
O hook `useFinishAuction.ts` (finalização manual pelo admin) não atualiza o campo `last_bidders` ao definir o bot vencedor. O frontend compensa com blindagem visual, mas o dado no banco fica inconsistente.

### Solução
Adicionar o prepend do bot vencedor no array `last_bidders` antes do UPDATE final.

### Alteração

**`src/hooks/useFinishAuction.ts`** — entre as linhas 61-76:

Após formatar o `winnerName`, buscar o `last_bidders` atual do leilão, fazer prepend do display name do bot (formato "Primeiro Segundo"), truncar para 3 itens, e incluir no UPDATE:

```typescript
// Buscar last_bidders atual
const { data: currentAuction } = await supabase
  .from('auctions')
  .select('last_bidders')
  .eq('id', auctionId)
  .single();

const botDisplay = formatUserNameForDisplay(selectedBot.full_name);
let currentBidders: string[] = Array.isArray(currentAuction?.last_bidders) 
  ? currentAuction.last_bidders : [];
currentBidders = [botDisplay, ...currentBidders].slice(0, 3);

// UPDATE incluindo last_bidders
.update({
  status: 'finished',
  winner_id: selectedBot.user_id,
  winner_name: winnerName,
  finished_at: new Date().toISOString(),
  last_bidders: currentBidders  // <-- novo
})
```

Isso fecha a última brecha, garantindo que **todos os caminhos de finalização** mantenham `last_bidders` sincronizado com o vencedor.

