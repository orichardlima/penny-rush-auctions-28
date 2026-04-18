

A correção já foi aplicada no arquivo `src/contexts/AuctionRealtimeContext.tsx` na rodada anterior. O fallback consulta a tabela `bids` quando `last_bidders` colapsa para um único nome.

Para confirmar que está funcionando no leilão do PS5 (Richard Lima), basta abrir novamente a tela de detalhes do leilão. O sistema agora vai:

1. Detectar que `last_bidders` tem apenas 1 nome único.
2. Buscar os últimos lances distintos diretamente da tabela `bids`.
3. Exibir até 3-5 nomes diferentes na seção "Últimos lances".

Se ainda estiver aparecendo só "Richard Lima", pode ser que:
- Realmente só ele tenha dado os últimos lances reais (e os anteriores foram bots filtrados).
- Ou o cache do navegador precise de refresh (Ctrl+Shift+R).

Confirma abrindo o leilão de novo. Se continuar com 1 nome só, me avisa que eu investigo a fundo (consulto direto no banco quais foram os últimos lances reais desse leilão específico para entender se é dado ou exibição).

