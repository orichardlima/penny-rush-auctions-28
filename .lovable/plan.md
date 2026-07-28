## Objetivo

Deixar visível para o usuário, tanto no resumo de `/meus-pontos` quanto na lista "Meus lances por leilão", a diferença entre:

- **Lances base**: comprados com R$ pagos (1 lance = R$ 1). Contam para Pontos Show quando usados em leilão que o usuário não venceu.
- **Lances bônus**: mimo do pacote (ex.: 15 grátis num pacote de 50). **Nunca** geram pontos.

Assim o usuário entende por que só uma parte do saldo evolui o progresso `X/12`.

## O que muda na tela `/meus-pontos`

### 1. Novo bloco "Saldo de lances" (dentro do cartão de saldo, abaixo dos pontos)

Três mini-indicadores:

- **Lances base disponíveis** (elegíveis a pontos) — soma de `remaining_amount` nos lotes `source='paid_purchase'` com `eligible_for_points=true`.
- **Lances bônus disponíveis** (não geram pontos) — soma de `remaining_amount` nos demais lotes ativos (bônus de pacote, contrato de parceiro, migração, brindes).
- **Total** — soma dos dois (bate com `profiles.bids_balance`).

Texto de apoio: "Somente lances base contam para Pontos Show. Bônus é cortesia da plataforma."

### 2. Card "Progresso do próximo Ponto Show"

Adicionar linha auxiliar abaixo do "em validação":

- "**N lances bônus** foram/serão usados nestes leilões e **não geram pontos**." — só aparece quando houver bônus consumidos ou pendentes.

### 3. Lista "Meus lances por leilão"

Cada linha passa a mostrar a quebra:

- `X pagos elegíveis + Y bônus` (quando houver bônus no mesmo leilão)
- Contagem de bônus aparece com cor muted e ícone/legenda "não gera ponto"

Resumo do topo ganha um 4º contador:

- **Bônus usados** — N lances em M leilões (nunca geram ponto)

Ordenação e status (Aguardando / Convertido / Vitória) permanecem inalterados.

## Detalhes técnicos

### Hook `usePointsWallet.ts`

Adicionar consulta a `bid_lots` do usuário com `remaining_amount > 0`, agrupando:

- `base_bids_available` = soma de `remaining_amount` onde `source='paid_purchase' AND eligible_for_points=true`
- `bonus_bids_available` = soma de `remaining_amount` do restante (inclui `source='purchase_bonus'`, `partner_contract`, `migration`, etc.)

Retornar esses dois números junto com `wallet` e `progress`.

### Hook `usePointsBidsByAuction.ts`

Trocar a consulta única em `bids` filtrada por `eligible_for_points=true` por duas contagens por `auction_id`:

- `base_count` = bids do usuário no leilão com `eligible_for_points=true`
- `bonus_count` = bids do usuário no leilão com `eligible_for_points=false` (excluindo lances gratuitos legados — filtrar por bids que consumiram algum lote via `bid_lot_consumptions`, ou simplesmente mostrar `total - base` a partir dos lots consumidos)

Solução simples e correta: usar `bid_lot_consumptions` (`bid_id`, `lot_id`, `amount`, `eligible`) juntando com `bid_lots.source` para saber se aquela consumo veio de lote base ou bônus. Agregar por `auction_id` (via `bids.auction_id`).

Retornar por linha: `base_count`, `bonus_count`, `bid_count` (soma), além dos campos atuais.

Manter as linhas cuja soma > 0. Uma linha só com bônus (0 base) continua aparecendo, com status "Aguardando"/"Convertido"/"Vitória" pelas mesmas regras (só que não vai virar ponto — o próprio contador de bônus deixa isso claro).

### Componentes

- `PointsProgressCard.tsx`: aceitar `bonusUsedOrPending` opcional e renderizar a linha auxiliar.
- `PointsBidsByAuctionList.tsx`: renderizar `base_count` + `bonus_count` por linha e adicionar o 4º card no resumo.
- `MeusPontos.tsx`: renderizar novo bloco "Saldo de lances" dentro do cartão de saldo já existente.

### Fora de escopo

- Nenhuma mudança em migrations, RPCs, triggers, webhooks, regras de FIFO ou lógica de crédito.
- Nenhuma mudança no admin, Loja Show, checkout ou histórico do ledger.
- Nenhuma mudança visual no cartão de saldo além do novo bloco interno.
