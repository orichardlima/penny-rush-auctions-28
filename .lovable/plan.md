## Problema

Quando a Sabriny saiu da rede da Géssica, a função `partner_request_leave_sponsor` reverteu apenas os bônus **diretamente gerados pelo contrato da Sabriny** (nível 1). Mas a Maria (indicada pela Sabriny) gerou bônus de nível 2 para a Géssica — esses R$ 500 continuam `AVAILABLE` no painel da Géssica.

Regra correta: quando um parceiro sai da rede, **toda a sub-rede que pendurava nele deixa de contar para a antiga upline**. Todos os bônus L1/L2/L3 que a antiga upline recebeu por causa de contratos descendentes da Sabriny precisam ser cancelados.

Exemplo confirmado no banco:
- Bônus L2 `dcbf3747...` — R$ 500, Géssica recebeu por aporte da Maria (indicada da Sabriny) — está `AVAILABLE` (deveria estar `CANCELLED`).

## Solução

### 1. Migration — corrigir funções de saída + backfill

Atualizar as três funções de saída (`partner_request_leave_sponsor`, `partner_leave_sponsor_network`, `admin_transfer_partner_sponsor`) para expandir o escopo da reversão:

Em vez de filtrar somente `referred_contract_id = p_contract_id`, usar uma CTE recursiva que monta o conjunto **{contrato que está saindo} ∪ {todos os descendentes via `referred_by_user_id`}**, e cancelar todos os bônus onde:
- `referred_contract_id IN (esse conjunto)`
- `referrer_contract_id` pertence a um contrato da antiga upline (sponsor antigo + 2 níveis acima, ou seja, qualquer contrato cujo `user_id` esteja na cadeia upline antiga até L3)

Para cada bônus `AVAILABLE` cancelado:
- decrementar `partner_contracts.available_balance` do referrer
- marcar `partner_payouts` vinculados (`referral_bonus_id`) como `CANCELLED`

Bônus `PENDING` no mesmo escopo também viram `CANCELLED` (sem mexer em saldo).

Atualizar `partner_network_exits.reversed_available_count/total` e `cancelled_pending_count/total` para refletir o escopo expandido.

### 2. Backfill pontual

Aplicar a mesma lógica para a saída já processada da Sabriny:
- Cancelar bônus `dcbf3747...` (R$ 500 L2 da Géssica).
- Decrementar R$ 500 do `available_balance` da Géssica (cai de R$ 4.500 → R$ 4.000).
- Cancelar `partner_payouts` correspondentes (se existirem) ao bônus L2.
- Repetir para qualquer outro bônus L2/L3 cujo `referred` esteja na sub-rede da Sabriny e cujo `referrer` esteja na upline antiga (Géssica e até 2 níveis acima).

## Verificação

- Após migration: o bônus L2 de R$ 500 da Maria → Géssica fica `CANCELLED`.
- Saldo de saque da Géssica passa de R$ 4.500 para R$ 4.000.
- Painel "Indique Parceiros" da Géssica não conta mais o bônus da Maria (o hook já exclui `CANCELLED` dos totais agregados; só precisa do banco corrigido).

## Escopo

Apenas o backend das três funções de saída e backfill. Nenhuma alteração de UI, workflow novo ou outras regras de negócio.
