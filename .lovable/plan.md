## Problema

A Sabriny saiu da rede da Géssica (registro em `partner_network_exits` IN_TRANSIT, com `reversed_available_count=1` / `reversed_available_total=4000`).

A função `partner_request_leave_sponsor` corretamente:
- Mudou o status do bônus de R$ 4.000 (id `9cf371d3...`) para `CANCELLED`.
- Decrementou o `available_balance` do contrato da Géssica.

Mas **não cancelou o registro correspondente em `partner_payouts`** (id `5c912c07-4255-4f80-94eb-aee1521a0a0f`, status PAID, R$ 4.000, vinculado via `referral_bonus_id`).

Como o saldo de saque do parceiro é calculado por `SUM(partner_payouts.PAID) - SUM(partner_withdrawals)`, esse payout fantasma faz o saldo de saque continuar incluindo os R$ 4.000 (saldo atual da Géssica: R$ 8.500, que cai para R$ 4.500 após a correção).

Também impacta a tela "Indique Parceiros", onde `stats.totalValue` e contagens por nível em `usePartnerReferrals` somam bônus `CANCELLED`, inflando os totais exibidos.

## Solução

### 1. Migration — corrigir função e fazer backfill

- Atualizar `partner_request_leave_sponsor` para, dentro do loop que cancela bônus AVAILABLE, também marcar o `partner_payouts` correspondente como `CANCELLED` (`UPDATE partner_payouts SET status='CANCELLED' WHERE referral_bonus_id = v_bonus.id AND status IN ('PAID','PENDING')`).
- Aplicar a mesma correção em qualquer outra função/admin tool que reverta bônus AVAILABLE (verificar a versão no `_0136e9a8` e em `TransferSponsorManager`).
- Backfill pontual: cancelar o payout `5c912c07-4255-4f80-94eb-aee1521a0a0f` (status `PAID` → `CANCELLED`) para que o saldo da Géssica reflita os R$ 4.500 reais.

### 2. Frontend — `src/hooks/usePartnerReferrals.ts`

Ajustar `stats` para **excluir bônus CANCELLED** de:
- `total`
- `totalValue`
- `byLevel.level1/2/3.count` e `.value`

Mantendo a linha CANCELLED visível no histórico (`bonuses` array continua igual, apenas a estatística agregada ignora cancelados).

## Verificação

- Após a migration: `SELECT SUM(amount) FROM partner_payouts WHERE partner_contract_id='f143036a...' AND status='PAID'` deve retornar 5.725, e o saldo disponível deve cair para R$ 4.500 (5.725 - 1.225 já sacados).
- Painel de "Indique Parceiros" da Géssica não deve mais contar a Sabriny nos cards de "Diretos / Total em bônus".
- O histórico continua mostrando a linha da Sabriny com badge "Cancelado".

## Escopo

Nenhuma outra UI ou workflow é alterado.
