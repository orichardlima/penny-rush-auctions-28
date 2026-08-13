# Correção do contrato do parceiro Nolasco (edmarcos25@hotmail.com)

## Diagnóstico confirmado

A tela está aritmeticamente correta, mas um dos valores está classificado errado na origem.

- Contrato Diamond: aporte R$ 25.000, teto R$ 55.000, `total_received` R$ 4.693.
- `total_received` é recalculado por `recalc_partner_contract_totals` somando **apenas** lançamentos `partner_payouts` com `payout_type = 'partnership_weekly_repass'` e status PAID. Bônus não abatem o teto — regra confirmada e que será mantida.
- Os R$ 4.693 vêm de 3 lançamentos, todos marcados como repasse semanal:
  - R$ 118 — semana 27/07 a 02/08 (repasse legítimo)
  - R$ 4.000 — crédito manual de 03/08 (`period_start = period_end = 2026-08-03`)
  - R$ 575 — semana 03/08 a 09/08 (repasse retroativo já corrigido)
- Existe 1 bônus de indicação de R$ 4.000 em status PENDING em `partner_referral_bonuses` para o mesmo contrato. O crédito manual de R$ 4.000 corresponde a esse bônus, mas foi lançado como repasse — por isso consumiu teto indevidamente e o bônus continua em aberto (risco de pagamento em duplicidade).
- Ele já sacou R$ 4.118 (saque legado PAID), ou seja, o saque cobriu R$ 118 de repasse + R$ 4.000 de bônus. Saldo disponível hoje: R$ 575.

Verificação de abrangência: esse é um caso pontual. Os outros 71 lançamentos com origem de bônus marcados como repasse estão CANCELLED e não afetam nenhum teto.

## O que será feito

1. **Reclassificar o lançamento de R$ 4.000** de 03/08 de repasse para bônus de indicação (`payout_type = 'direct_referral_bonus'`, `source = 'referral_bonus'`), preservando o histórico — nada é apagado.
2. **Quitar o bônus de indicação PENDING de R$ 4.000**, marcando-o como pago e vinculado a esse lançamento, para eliminar o risco de pagar duas vezes.
3. **Registrar o bônus na carteira de rede** dele (`partner_network_wallets`), com o crédito de R$ 4.000 e a respectiva saída de R$ 4.000 já sacada — carteira fecha em zero, refletindo a realidade.
4. **Separar o saque de R$ 4.118** entre R$ 118 de repasse e R$ 4.000 de bônus, para que o teto e o saldo continuem batendo.
5. **Recalcular os totais do contrato**.

## Resultado esperado na tela do parceiro

| Campo | Antes | Depois |
|---|---|---|
| Total Recebido | R$ 4.693 | R$ 693 |
| Falta para o Teto | R$ 50.307 | R$ 54.307 |
| Progresso até o teto | 8,5% | 1,3% |
| Saldo disponível | R$ 575 | R$ 575 (inalterado) |
| Bônus recebido (carteira) | não registrado | R$ 4.000 creditado / R$ 4.000 sacado |

O percentual do card "Total Recebido" continua calculado sobre o aporte, como hoje (sem mudança de UI).

## Detalhes técnicos

- Migration de correção de dados pontual, restrita ao contrato `4922a471-d363-4d3d-aec2-1a6d0ad12454`.
- O saque legado `40353ae2` passa para o fluxo v2 (`uses_allocations = true`) com duas alocações CONFIRMED: R$ 118 em `partnership_repass` vinculada ao contrato e R$ 4.000 como bônus de rede sem contrato — assim `recalc_partner_contract_totals` passa a contabilizar apenas os R$ 118 na coluna de sacado, mantendo o disponível em R$ 575.
- O gatilho `protect_partner_contract_sensitive_fields` será contornado apenas durante o recálculo, como já feito em correções anteriores.
- Nenhuma regra de negócio é alterada: bônus continuam **não** abatendo o teto; nenhuma alteração em `recalc_partner_contract_totals`, na rotina semanal ou na interface.
