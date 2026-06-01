
# Estornar payouts de bônus de indicação pré-corte (todos os parceiros)

## Contexto
Na migração anterior, 75 registros em `partner_referral_bonuses` criados antes de **11/05/2026 14:22:36** (cadastro da Géssica) foram marcados como `CANCELLED`. Porém, os `partner_payouts` correspondentes (que efetivamente compõem o saldo sacável via fórmula `Σ payouts PAID − Σ saques`) continuam `PAID` e seguem inflando o `available_balance` de vários parceiros — exatamente como no caso do Mariano (R$ 1.924,80 indevidos).

## Escopo confirmado
- **69 payouts** com `source='referral_bonus'` e `status='PAID'` referenciam bônus já `CANCELLED`.
- **Total a estornar: R$ 62.074,44**
- **15 contratos de parceiros afetados** (inclui Mariano).
- Critério: `partner_referral_bonuses.status = 'CANCELLED'` (já filtrado pela data de corte da Géssica via trigger e migração anterior).

## Ações da migração

1. **Marcar payouts pré-corte como CANCELLED**
   - `UPDATE partner_payouts` para todos os `id` em que `source='referral_bonus'`, `status='PAID'` e `referral_bonus_id` aponta para um bônus `CANCELLED`.
   - Novo status: `CANCELLED`.
   - Não tocar em `paid_at` (preservar histórico).

2. **Recalcular `total_received` dos contratos afetados**
   - Para cada `partner_contract_id` na lista, atualizar `partner_contracts.total_received = SUM(amount) WHERE status='PAID'` para refletir só payouts ainda válidos.

3. **Não mexer em saques já realizados**
   - Saques `PAID`, `APPROVED` ou `PENDING` permanecem inalterados — o saldo recalculado vai naturalmente cair, e em alguns casos pode ficar zerado ou indicar que o parceiro sacou mais do que tinha direito (ficará registrado no histórico para análise admin posterior).

4. **Salvaguarda futura**
   - Criar trigger `BEFORE INSERT` em `partner_payouts`: se `source='referral_bonus'` e o `referral_bonus_id` referenciado tiver `status='CANCELLED'`, força `NEW.status='CANCELLED'`. Evita que recálculos futuros "ressuscitem" o valor.

## Validação pós-migração
- `SUM(amount) FROM partner_payouts WHERE source='referral_bonus' AND status='PAID' AND referral_bonus_id IN (CANCELLED)` deve retornar 0.
- Saldo do Mariano (`contrato 879cbe85…`) deve cair de R$ 2.154,77 para ~R$ 229,98 (somente weekly_aporte − saques).
- Conferir os outros 14 contratos no painel admin.

## Observações
- Nada de UI muda — `useReferralBonuses`, `usePartnerCashflow` e `calculateAvailableBalance` já filtram por status corretamente.
- Saques já pagos (PAID) não são revertidos — admin pode analisar caso a caso depois.
