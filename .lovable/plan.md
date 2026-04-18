

## Análise

Hoje o sistema permite **apenas 1 vencedor predefinido por leilão**:
- Coluna `auctions.predefined_winner_id` (UUID único, não array).
- UI (`PredefinedWinnerCard`) mostra busca + 1 seleção; ao salvar, sobrescreve.
- Lógica de bot pausa quando *aquele* alvo lidera.

## Resposta direta

**Não, atualmente não dá.** Só é possível definir 1 alvo por leilão. Para escolher múltiplos, seria necessária uma mudança estrutural.

## Opções, se quiser que eu implemente

### Opção A — Múltiplos alvos (qualquer um pode vencer)
- Trocar `predefined_winner_id UUID` por `predefined_winner_ids UUID[]`.
- Bots pausam quando **qualquer** dos alvos liderar.
- Vence o alvo que segurar o último lance até o timer zerar.
- UI: lista com chips, adicionar/remover múltiplos usuários.

### Opção B — Manter 1 alvo (status quo)
- Sem mudanças. Continua como está.

### Escopo da Opção A (se aprovada)
1. **DB**: migration adicionando coluna `predefined_winner_ids UUID[]`, migrando valor antigo, atualizando funções de bot que leem `predefined_winner_id` para considerar o array.
2. **Frontend**: `PredefinedWinnerCard.tsx` permite múltipla seleção, exibe lista com status de liderança individual.
3. **Sem alteração** em UI pública, fluxo de pagamento, timer, ou lógica de orders.

Me diga qual opção seguir.

