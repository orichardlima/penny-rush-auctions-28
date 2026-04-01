

# Trocar "Quantidade de Lances" por "Pessoas Disputando" no AuctionCard

## Resumo

Substituir a exibição de "703 lances" por "X pessoas disputando" no card de leilão, usando o campo `participants` que já está disponível via props e Context.

## Alteração

### `src/components/AuctionCard.tsx`

- Linha 282-286: Trocar o ícone `Gavel` por `Users` (importar de lucide-react)
- Trocar `{displayTotalBids} lances` por `{displayParticipants} disputando`
- Adicionar variável `displayParticipants` usando `contextAuction?.participants ?? participants`
- Atualizar aria-label correspondente

### Nada mais alterado

- Props `totalBids` e `participants` já existem no componente
- O Context já fornece `participants` via `participants_count`
- Nenhum outro componente, hook ou fluxo modificado

