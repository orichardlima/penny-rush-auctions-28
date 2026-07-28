
## Contexto

Hoje o `/meus-pontos` mostra apenas números agregados:
- Progresso `X/12 lances elegíveis` no bucket atual
- Total de "lances pagos em validação" (leilões ainda ativos), sem detalhar em quais leilões
- Histórico do ledger (ganhos/resgates), mas sem mostrar lances pagos que ainda não viraram ponto

O usuário não consegue ver **por leilão** quantos lances pagos deu, quantos ainda estão "aguardando o leilão terminar" e quantos já viraram Ponto Show.

## O que construir

Uma nova seção **"Meus lances por leilão"** no `/meus-pontos`, entre o card de Progresso e o Histórico, listando cada leilão em que o usuário deu lances pagos elegíveis, com status claro por linha.

### Cada linha mostra
- Miniatura + título do produto (leilão)
- Total de **lances pagos elegíveis** que o usuário deu naquele leilão
- Badge de status:
  - **Aguardando (leilão ativo)** — leilão `status='active'`, lances ainda podem virar ponto
  - **Vitória sua (não gera ponto)** — leilão finalizado e o `orders` daquele leilão é do usuário
  - **Convertido em pontos** — leilão finalizado, usuário não venceu, lances já contabilizados no bucket/ledger
- Data do último lance
- Link "Ver leilão"

Ordenação: primeiro os ativos (mais recentes), depois finalizados recentes.

### Resumo no topo da seção
Três contadores:
- `Aguardando: N lances em M leilões ativos`
- `Convertidos: N lances em M leilões finalizados`
- `Sem ponto (vitórias): N lances em M leilões vencidos`

Isso complementa (não substitui) o card de progresso `X/12` que já existe.

## Detalhes técnicos

**Novo hook** `src/hooks/usePointsBidsByAuction.ts`:
1. Buscar `bids` do usuário com `eligible_for_points = true` agrupando por `auction_id` (contagem + max(created_at)).
2. Para os `auction_id` retornados, buscar `auctions` (`id, title, image_url, status, finished_at, winner_id`) e `orders` (`auction_id, user_id`) para identificar vitórias.
3. Classificar cada leilão em `waiting | converted | won` no cliente e devolver a lista já ordenada.

**Novo componente** `src/components/Points/PointsBidsByAuctionList.tsx`:
- Card com título "Meus lances por leilão"
- Resumo (3 contadores)
- Lista de linhas com thumb, título, contagem, badge de status, data, botão "Ver leilão"
- Estado vazio didático quando não houver nenhum lance pago elegível ainda
- Skeleton enquanto carrega

**Integração em `src/pages/MeusPontos.tsx`**:
- Chamar o novo hook e renderizar `<PointsBidsByAuctionList />` entre `PointsProgressCard` e `PointsHistoryList`.
- Nenhuma mudança em backend, RPCs, migrations, webhooks ou regras de pontuação.

## Fora de escopo

- Não alterar lógica de FIFO, elegibilidade, settlement ou triggers.
- Não mexer no admin, Loja Show, ou fluxo de compra.
- Não alterar o card de saldo nem o histórico de ledger existentes.
