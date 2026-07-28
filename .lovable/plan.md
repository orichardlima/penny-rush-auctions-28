## Objetivo
Garantir, de forma explícita e à prova de regressão, que **lances de bots nunca gerem Pontos Show**, mesmo em cenários futuros de mudança de regra ou bug.

## Estado atual (verificado)
- Bots inserem lances direto em `bids` (função `execute_overdue_bot_bids`), sem passar por `place_bid`, com `cost_paid=0` e `eligible_for_points` no default (false).
- `place_bid` (usuários reais) já força `eligible_for_points=false` quando `is_bot=true`.
- `points_settle_auction` já filtra `profiles.is_bot=false` ao apurar pontos.
- Ou seja, hoje bots **não** geram pontos, mas a proteção depende de o default do campo continuar `false` e do filtro no settle. Não há barreira física.

## Mudanças propostas (defesa em profundidade, sem alterar UI/UX)

1. **Trigger `bids_block_bot_points_eligibility` (BEFORE INSERT OR UPDATE em `public.bids`)**
   - Se o `user_id` pertencer a um perfil com `is_bot=true` (ou `is_test_account=true`, ou admin), força:
     - `NEW.eligible_for_points := false`
     - `NEW.points_rule_id := NULL`
     - `NEW.points_campaign_id := NULL`
     - `NEW.points_multiplier_snapshot := NULL`
     - `NEW.lot_id := NULL` / `NEW.source := NULL` (bots não consomem lote pago)
   - Idempotente e barato; garante que nada a jusante contabilize bot.

2. **Reforço em `points_settle_auction`**
   - Manter o filtro atual (`is_bot=false`) e adicionar comentário/CHECK explícito para evitar remoção acidental. Nenhuma mudança de comportamento.

3. **Backfill defensivo (uma vez, dentro da mesma migration)**
   - `UPDATE public.bids SET eligible_for_points=false, points_rule_id=NULL, points_campaign_id=NULL, points_multiplier_snapshot=NULL WHERE user_id IN (SELECT user_id FROM profiles WHERE is_bot=true) AND eligible_for_points=true;`
   - Garante estado limpo antes da data de corte.

4. **Sem alteração** em: UI, `place_bid`, fluxo de compras, loja, dashboards, webhooks, regras existentes.

## Verificação após aplicar
- Inserir manualmente um `bids` com `user_id` de bot e `eligible_for_points=true` → conferir que o trigger reescreve para `false`.
- Rodar `points_settle_auction` em leilão de teste com bots participando → confirmar que nenhum bot aparece em `auction_points_settlement_items`.
- Confirmar que `bid_lot_consumptions` para bots permanece vazio.

## Fora de escopo
- Mudanças em UI do admin/usuário.
- Alterar lógica de bots ou de finalização de leilão.
- Alterar regras de pontuação (12:1) ou flags.
