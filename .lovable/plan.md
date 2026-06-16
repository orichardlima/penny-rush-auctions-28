## Diagnóstico

Confirmei via banco que o trigger `bids_refresh_last_bidders` atualiza corretamente `auctions.last_bidders` a cada novo lance (bot ou real). Por exemplo, no leilão "Smart TV 43" 4K UHD" o último lance do Richard Lima foi às 18:16:07, e `last_bidders` já está `[Vanessa Machado, Emerson Vasconcelos, Luna Paiva]` com `last_bid_at = 18:20:45`. Ou seja, o banco está correto.

O problema é puramente no cliente: depois que o usuário real (Richard Lima) dá lance, a UI fica "presa" exibindo o nome dele no topo mesmo quando bots já bateram lances depois. Isso acontece porque:

1. O `AuctionRealtimeContext` depende exclusivamente de eventos `postgres_changes UPDATE` na tabela `auctions` para atualizar `recentBidders`.
2. Cada lance dispara DOIS UPDATEs na mesma transação (trigger `bids_refresh_last_bidders` + trigger `update_auction_on_bid`). Em alguns cenários (perda momentânea de evento, reconexão silenciosa do canal, throttle do Realtime, ou o segundo evento chegando primeiro com payload em ordem invertida) a UI processa um payload que já tem `current_price`/`last_bid_at` novos mas `recentBidders` correspondente ao estado pré-trigger, e como o estado seguinte não muda mais aquela linha por alguns segundos, o nome do Richard "trava" no topo.
3. O `displayRecentBidders` no `AuctionCard` cai no fallback para a prop (`recentBidders`) quando `contextAuction.recentBidders` está vazio — mas a prop nunca muda depois do mount, então também pode amplificar a sensação de "travado".

## Mudanças (somente nessa parte da UI/realtime — sem mexer em motor de bots, finalização, pagamentos, parceiros, fury vault, RLS, regras de negócio)

### 1. `src/contexts/AuctionRealtimeContext.tsx`

- **Re-sync forçado após qualquer lance**: assinar também `INSERT` em `public.bids` no mesmo canal Realtime. Em cada INSERT, chamar `fetchSingleAuction(payload.new.auction_id, 500)` (throttle curto de 500ms) para garantir que `last_bidders` é re-lido direto do banco logo após o trigger commitar. Isso resolve qualquer caso de evento perdido/fora de ordem na tabela `auctions`.
- **Preservar `recentBidders` quando payload vier vazio**: em `updateAuction`, se `newData.last_bidders` for `null`/`[]` mantenha o `recentBidders` atual do estado em vez de zerar (evita o piscar para a prop estática).

### 2. `src/components/AuctionCard.tsx`

- Remover o fallback para a prop estática: usar diretamente `contextAuction?.recentBidders ?? recentBidders`. A prop só vale como valor inicial enquanto o contexto não tem o leilão; depois que o contexto preenche, manda sempre o array do contexto (mesmo se temporariamente curto), evitando "congelar" um snapshot antigo.

### 3. (Opcional, defensivo) `rebuild_auction_last_bidders`

Já está correto. Sem alteração.

## Validação

- Logar no console quando o INSERT em `bids` chega e quando `fetchSingleAuction` re-sincroniza.
- Em um leilão ativo: dar um lance como Richard Lima, observar o nome subir ao topo, esperar 2–8s, confirmar que assim que o bot bate o lance o nome do bot aparece no topo e o Richard desce ou sai dos 3.
- Verificar via Supabase logs que não há aumento significativo de chamadas (throttle de 500ms já protege).

## Fora de escopo

UI fora do card de últimos lances, motor de bots, finalização, vencedor, fury vault, pagamentos, parceiros, RLS, contagem de participantes.
