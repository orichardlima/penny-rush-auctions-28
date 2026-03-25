
# Remover os arremates do Ailton Nobre da home

## Diagnóstico
O problema do print não está na seção "Vencedores Recentes". Ela já filtra `winner_name` no hook `useRecentWinners`.

O que ainda aparece é a grade principal da home (`Leilões Ativos Agora`), que também inclui leilões `finished` por algumas horas. Esses cards vêm do `AuctionRealtimeContext`, e hoje não existe filtro ali para ocultar leilões finalizados cujo ganhador seja "Ailton Nobre".

## Implementação
Vou ajustar a origem correta dos cards da home:

1. Em `src/contexts/AuctionRealtimeContext.tsx`
   - Criar uma checagem para identificar vencedores que contenham `"Ailton Nobre"` no nome.
   - Aplicar essa regra apenas para leilões `finished`, antes de salvar os itens visíveis no estado.
   - Considerar tanto `winner_name` bruto quanto o nome enriquecido com cidade/UF (`winnerName`), para o filtro continuar funcionando mesmo após formatação.

2. Manter o comportamento atual dos demais leilões
   - `active` e `waiting` continuam aparecendo normalmente.
   - Apenas os finalizados com esse vencedor deixam de aparecer na home.

3. Preservar a exclusão já existente em `useRecentWinners`
   - Não preciso mexer nela, porque o problema do print vem de outro fluxo.

## Arquivo
| Arquivo | Mudança |
|---|---|
| `src/contexts/AuctionRealtimeContext.tsx` | Filtrar da home os leilões finalizados cujo vencedor seja Ailton Nobre |

## Resultado esperado
Depois da correção, os cards de leilões encerrados ganhos por Ailton Nobre deixam de aparecer na home, inclusive na grade principal mostrada no print.
