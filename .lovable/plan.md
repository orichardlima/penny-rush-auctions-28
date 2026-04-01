

# Ajustar Exibição de Participantes e Indicador de Atividade no AuctionCard

## Resumo

Trocar "X disputando" por "👥 X participantes" e adicionar um indicador textual de atividade baseado na recência do último lance (`last_bid_at`), sem oscilações bruscas.

## Lógica do Indicador de Atividade

Baseado na diferença entre `Date.now()` e `last_bid_at` (já disponível no Context via `AuctionData.last_bid_at`):

- **Menos de 30s** desde o último lance → "🔥 Muito disputado"
- **30s a 90s** → "⚡ Disputa aquecendo"
- **Mais de 90s** ou sem lances → "🟢 Começando agora"

Apenas exibido para leilões com `status === 'active'`. O valor atualiza automaticamente porque o Context já faz re-render quando `last_bid_at` muda via realtime.

Para evitar oscilação brusca, usar um `useRef` que guarda o último nível de atividade e só muda se o novo nível for diferente por mais de 5 segundos (debounce simples via `useEffect` + `setTimeout`).

## Alterações

### `src/components/AuctionCard.tsx`

1. **Linha 286**: Trocar texto de `{displayParticipants} disputando` para `👥 {displayParticipants} participantes`
2. **Remover ícone `Users`** da linha (o emoji 👥 substitui)
3. **Adicionar função `getActivityIndicator()`**: calcula o indicador com base em `contextAuction?.last_bid_at`
4. **Adicionar `useEffect` + `useRef`** para debounce do indicador (evitar oscilações)
5. **Renderizar indicador** logo após a linha de participantes, apenas quando `displayStatus === 'active'`

### Nenhum outro arquivo alterado

- O campo `last_bid_at` já existe em `AuctionData` e é atualizado pelo realtime
- Nenhuma prop nova necessária
- Nenhum hook, Context, tabela ou fluxo modificado

