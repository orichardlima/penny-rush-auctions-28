
## Resumo

Adicionar 2 novos modos opcionais de finalização, **complementares** ao `predefined_winner_ids` atual (não substituem):

1. **Modo "Qualquer real ganha"** — toggle on/off. Quando ON, qualquer usuário real liderando pausa bots e ganha.
2. **Modo "Lances mínimos"** — campo numérico. Real precisa ter ≥ N lances no leilão para se qualificar. `0` = sem mínimo (qualquer real elegível assim que dá 1 lance).

Os 3 modos podem ser combinados livremente:

| open_win | min_bids | predefined_ids | Quem pode ganhar |
|---|---|---|---|
| OFF | – | vazio | Só bot (atual) |
| OFF | – | [Richard] | Richard (atual) |
| ON | 0 | vazio | Qualquer real liderando |
| ON | 10 | vazio | Real com ≥10 lances liderando |
| ON | 10 | [Richard] | Richard (sem mínimo) OU qualquer real com ≥10 lances |

## Mudanças

### 1. DB — Migration única
- `ALTER TABLE auctions` adiciona:
  - `open_win_mode BOOLEAN NOT NULL DEFAULT false`
  - `min_bids_to_qualify INTEGER NOT NULL DEFAULT 0`
- Atualizar `block_bot_bid_when_target_leading()`:
  - Se `open_win_mode = true` E último lance for de um real
  - E (`min_bids_to_qualify = 0` OU contagem de lances daquele real ≥ `min_bids_to_qualify`)
  - → bloquear bid de bot (mesmo padrão dos predefinidos).
- Manter compatibilidade total com `predefined_winner_ids`.

### 2. Edge function `auction-protection/index.ts`
- Novo helper `getEligibleRealLeader(auctionId, openWin, minBids, predefinedIds)`:
  - Retorna `user_id` do líder se: (a) está em `predefined_winner_ids`, OU (b) `open_win_mode=true` + é real + tem ≥ `min_bids`.
- Substituir chamadas a `isPredefinedWinnerLeading()` por esse helper.
- Novo `finalizeWithRealUser(userId, reason, action)` para finalizar com qualquer real elegível (generaliza `finalizeWithPredefinedWinner`).
- Bot só é injetado se nenhum real elegível liderar.

### 3. Frontend — `PredefinedWinnerCard.tsx` (renomear seção, manter componente)
- Adicionar acima da lista de predefinidos:
  - **Toggle**: "Liberar para qualquer usuário real ganhar"
  - **Input numérico**: "Lances mínimos para qualificar usuário real" (visível só se toggle ON; default 0)
  - **Status em tempo real**: mostra líder atual + se está elegível + qual regra disparou.
- Botão "Salvar configuração" persiste `open_win_mode` e `min_bids_to_qualify` em `auctions`.
- Audit log das mudanças (action_type `update_open_win_config`).
- Manter toda a UI atual de predefined_winner_ids intacta abaixo.

### 4. Sem alterações em
- UI pública (cards, bid flow).
- `orders`, pagamento, timer.
- `update_auction_on_bid` ou outras funções não relacionadas.
- `predefined_winner_ids` continua funcionando exatamente como hoje.

## Escopo
- 1 migration SQL (~60 linhas: ALTER + 1 função recriada).
- 1 edge function alterada (`auction-protection/index.ts`).
- 1 componente React alterado (`PredefinedWinnerCard.tsx`).
- 0 alterações em outros arquivos.
