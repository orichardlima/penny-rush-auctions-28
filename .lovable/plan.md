

# Melhorar Exibição de Participantes e Status no AuctionCard

## Resumo

Reorganizar a seção de métricas do card para layout vertical (status → participantes → tempo), formatar participantes com "+" para números ≥ 100, renomear "Muito disputado" para "Disputa intensa", e adicionar mensagem de urgência quando timer < 15s.

## Alterações

### `src/components/AuctionCard.tsx`

**1. Renomear label de atividade** (função `getRawActivity`, ~linha 92):
- Trocar `'🔥 Muito disputado'` por `'🔥 Disputa intensa'`

**2. Formatar participantes** (seção de exibição, ~linha 311):
- Se `displayParticipants >= 100`: exibir `👥 +{displayParticipants} participantes`
- Se `< 100`: exibir `👥 {displayParticipants} participantes`

**3. Reordenar layout** (~linhas 309-327):
- Substituir o `div` horizontal com `flex-wrap` por layout vertical (`flex-col`)
- Linha 1: indicador de atividade (apenas para `active`)
- Linha 2: participantes
- Linha 3: tempo ativo (apenas para `active` ou `finished`)
- Manter desconto `% OFF` na mesma linha dos participantes ou abaixo

**4. Mensagem de urgência** (nova, logo antes do botão de lance):
- Quando `displayStatus === 'active'` e `displayTimeLeft > 0` e `displayTimeLeft < 15`:
- Exibir: `⏳ Pode encerrar a qualquer momento`
- Estilo: texto amarelo/amber, pequeno, com animação sutil de pulse

### Nenhum outro arquivo alterado

- Nenhum hook, Context, tabela, Edge Function ou fluxo modificado
- Apenas reorganização visual e ajuste de textos dentro do AuctionCard

