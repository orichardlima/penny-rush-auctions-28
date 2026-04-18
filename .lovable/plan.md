
Objetivo: corrigir a seção “Últimos lances” para mostrar os nomes reais dos últimos 3 lances, na ordem correta, sem trocar por “Usuário” e sem mexer em outras partes da UI/fluxo.

Diagnóstico confirmado:
- O problema atual não é só visual.
- No leilão `93d9f950-c0b2-4422-927c-698b2caa96c0` (PlayStation 5 SLIM), os 3 últimos lances reais no banco são:
  1. Richard Lima
  2. Richard Lima
  3. Sueli Cerqueira
- Mas `auctions.last_bidders` ficou salvo como `["Richard Lima","Richard Lima","Richard Lima"]`.
- Além disso, a correção anterior piorou a UI porque o frontend passou a buscar `bids` + `profiles` no cliente; por causa do RLS de `profiles`, ele não consegue resolver nomes de outros usuários/bots e cai no fallback `"Usuário"`.

O que vou corrigir:
1. Remover a lógica que “inventa”/reordena os últimos lances no frontend
- Em `src/contexts/AuctionRealtimeContext.tsx`:
  - remover o fallback cliente que consulta `bids` + `profiles`;
  - remover a lógica que prioriza/injeta o vencedor na lista de `recentBidders`;
  - usar os 3 nomes exatamente como vierem de `auctions.last_bidders`.

2. Corrigir a origem do dado no momento da finalização
- Em `supabase/functions/sync-timers-and-protection/index.ts`
- Em `supabase/functions/auction-protection/index.ts`
- Em `src/hooks/useFinishAuction.ts`
- Ajustar para não fazer mais “prepend” do vencedor/bot em `last_bidders` ao finalizar.
- `last_bidders` deve refletir os últimos 3 lances reais do histórico do leilão, não o vencedor duplicado artificialmente.

3. Backfill dos dados já corrompidos
- Criar migration para reconstruir `auctions.last_bidders` a partir da tabela `bids` + `profiles`, respeitando ordem por `created_at desc` e limite 3.
- Isso corrige o leilão do print e outros finalizados afetados.

Resultado esperado
- A área “Últimos lances” passará a mostrar exatamente quem deu os últimos 3 lances.
- Se a mesma pessoa der 2 lances seguidos, o nome aparecerá repetido 2 vezes, porque são 2 lances diferentes.
- Não aparecerá mais “Usuário” nessa seção.

Exemplo esperado para o leilão do print
- Richard Lima
- Richard Lima
- Sueli Cerqueira

Detalhes técnicos
- O frontend público deve consumir apenas `auctions.last_bidders`, que já é um campo seguro para exibição.
- A reconstrução dos nomes precisa acontecer no servidor/banco, não no cliente, para não esbarrar no RLS da tabela `profiles`.
- Não vou alterar layout, card, fluxo de lance, timer, vencedor, nem outras áreas não relacionadas.
