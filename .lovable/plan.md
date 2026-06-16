Plano para corrigir o comportamento ainda travado dos últimos lances e do timer, sem mexer em UI, pagamentos, parceiros, vencedor, finalização, fury vault, RLS ou fluxos externos.

1. Corrigir a fonte de verdade no banco
- Ajustar a função `update_auction_on_bid()` para o timer do leilão usar exatamente o horário do lance inserido (`NEW.created_at`) como `last_bid_at`.
- Hoje há evidência de descompasso: o leilão pode ter `last_bid_at` mais novo que o último registro real em `bids`, fazendo o timer reiniciar sem o nome correspondente subir para o topo.
- Alterar o padrão de `bids.created_at` para `clock_timestamp()` para novos lances registrarem o horário real do evento, não o horário de início da transação.

2. Corrigir a ordenação dos últimos lances
- Ajustar `rebuild_auction_last_bidders()` para reconstruir a lista sempre a partir dos últimos registros reais da tabela `bids`, ordenados pelo horário do lance mais recente.
- Manter a lista como: último lance primeiro, depois penúltimo, depois antepenúltimo, sem privilegiar usuário real nem bot.

3. Corrigir o reflexo imediato no frontend
- No `AuctionRealtimeContext`, tratar `INSERT` em `bids` como evento principal de lance.
- Quando chegar um novo lance, atualizar imediatamente o card daquele leilão com:
  - `last_bid_at` do próprio lance;
  - nome do usuário/bot que acabou de lançar no topo de `recentBidders`;
  - timer recalculado a partir desse lance.
- Depois disso, manter o resync com `auctions` apenas como confirmação do banco, sem deixar payload antigo sobrescrever lista mais nova.

4. Evitar regressão por eventos fora de ordem
- Proteger o estado local para nunca substituir um `last_bid_at` mais novo por um mais antigo.
- Se um update de `auctions` chegar atrasado, ele não poderá trazer de volta um nome antigo para o topo.

5. Validação
- Conferir no banco se, nos leilões ativos, `auctions.last_bid_at` passa a bater com o último `bids.created_at`.
- Conferir que, após lance real ou bot, o nome correspondente aparece imediatamente no topo dos “Últimos lances”.
- Conferir que o timer só reinicia quando há novo registro em `bids`.
- Checar slow queries depois da mudança para garantir estabilidade.

Escopo mantido: somente motor de sincronização de lances/timer e ranking dos últimos lances.