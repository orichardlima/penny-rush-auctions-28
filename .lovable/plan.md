

## Diagnóstico

O usuário está vendo o leilão finalizado do PS5 onde o vencedor é Richard Lima. Ele esperava ver os "Últimos lances" com 2-3 nomes (não só o do vencedor).

Preciso investigar:
1. Como o componente exibe "Últimos lances" — provavelmente usa `auctions.last_bidders` (jsonb) ou consulta `bids` recente.
2. Por que só aparece 1 nome — pode ser:
   - O array `last_bidders` está com só 1 item
   - Houve filtro removendo bots (e os 2 últimos antes dele eram bots)
   - Componente pega só o vencedor por engano
   - Após finalização, algum processo limpa/sobrescreve

## Plano de investigação

1. Ler `AuctionDetailView.tsx` (componente da tela exibida) para ver de onde vem "Últimos lances".
2. Conferir lógica em `useAuctionData.ts` ou similares.
3. Consultar no banco o `last_bidders` desse leilão e os últimos `bids` reais para entender se é problema de dados ou de exibição.
4. Confirmar com o usuário a causa real e propor correção pontual (sem alterar UI/fluxos não relacionados, conforme regra do projeto).

## Próxima ação após aprovação

Vou ler os arquivos relevantes e consultar o banco para localizar a causa exata. Em seguida apresento outro plano com a correção específica (provavelmente ajustar a fonte de dados ou o filtro de bots para mostrar também não-vencedores reais/bots dos últimos lances).

Nada será alterado fora da seção "Últimos lances" da tela de detalhes do leilão.

