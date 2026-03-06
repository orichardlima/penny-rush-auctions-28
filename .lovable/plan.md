

## Plano: Indicar se o vencedor é Bot ou Usuário Real no painel admin

### Problema
No detalhe do leilão no painel admin, o campo "Vencedor" mostra apenas o nome, sem indicar se é um bot ou usuário real.

### Solução
Consultar `profiles.is_bot` do `winner_id` e exibir um badge ao lado do nome do vencedor indicando "Bot" (vermelho) ou "Usuário Real" (verde).

### Alterações

**Arquivo: `src/components/AuctionDetailView.tsx`**

1. Adicionar um `useEffect` + `useState` para buscar `is_bot` do perfil do vencedor quando `auction.winner_id` estiver presente
2. No bloco do "Vencedor" (linha ~284-292), adicionar um `Badge` ao lado do nome:
   - Se bot: Badge vermelho com ícone `Bot` e texto "Bot"
   - Se usuário real: Badge verde com ícone `Users` e texto "Usuário Real"
   - Enquanto carrega: nada extra exibido

### Escopo mínimo
- Apenas uma query adicional (`profiles.is_bot` por `winner_id`)
- Apenas visual — nenhuma lógica de negócio alterada
- Nenhum outro componente ou página afetado

