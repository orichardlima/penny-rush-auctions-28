
O usuário quer apenas que a seção "Últimos lances" volte a mostrar os nomes reais dos 3 últimos lances (ex: Richard, Richard, Sueli) — como sempre funcionou. Hoje aparece "Richard" 3x ou "Usuário".

Já temos a função `rebuild_auction_last_bidders` criada no banco. Falta:
1. Rodar o backfill em todos os leilões finalizados (corrige os dados históricos do PS5 e outros).
2. Remover a lógica do frontend que reordena/injeta o vencedor e cai em "Usuário".
3. Remover o "prepend" do vencedor em `last_bidders` na finalização (edge functions + hook).
4. Garantir que novos lances atualizem `last_bidders` corretamente (verificar se já existe trigger; senão, criar um simples que chama `rebuild_auction_last_bidders` após cada bid).

## Plano

**1. Backfill imediato (corrige o PS5 agora)**
Rodar no banco:
```sql
DO $$ DECLARE r record; BEGIN 
  FOR r IN SELECT id FROM auctions WHERE status='finished' LOOP
    PERFORM public.rebuild_auction_last_bidders(r.id);
  END LOOP;
END $$;
```

**2. Trigger automático em `bids`**
Criar trigger `AFTER INSERT ON bids` que chama `rebuild_auction_last_bidders(NEW.auction_id)`. Assim `last_bidders` sempre reflete os 3 últimos lances reais — sem depender de prepend manual.

**3. Frontend (`AuctionRealtimeContext.tsx`)**
Remover:
- fallback que consulta `bids`+`profiles` no cliente (causa "Usuário" por RLS);
- lógica que injeta/prioriza o vencedor em `recentBidders`.
Consumir apenas `auctions.last_bidders` direto.

**4. Edge functions e hook**
Em `auction-protection/index.ts`, `sync-timers-and-protection/index.ts` e `useFinishAuction.ts`: remover o trecho que faz `[botDisplay, ...currentBidders]`. O trigger do passo 2 já cuida disso porque o bid final do bot é inserido em `bids`.

## Resultado
- PS5 passa a mostrar: Richard Lima, Richard Lima, Sueli Cerqueira.
- Novos leilões mantêm a lista correta automaticamente.
- Some o "Usuário".
- Nada de UI/fluxo/timer/vencedor é alterado.
