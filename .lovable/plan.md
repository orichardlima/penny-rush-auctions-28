# Por que a tela da Géssica mostra R$ 0,00 em Repasses

## O que os dados mostram (consulta somente leitura)

Contrato Diamond `#F143036A` (ACTIVE, aporte R$ 25.000, teto R$ 55.000, teto semanal R$ 625).

- Total de repasses **creditados** (payouts PAID): **R$ 10.425,00**
- Total **sacado** (saques PAID): **R$ 12.625,00**
- Saldo = 10.425 − 12.625 = **−2.200** → a função de saldo limita em zero, por isso a tela mostra **R$ 0,00**

Ou seja: a tela não perdeu valores, ela está refletindo um saldo negativo real no contrato.

## Por que ficou negativo

O bônus de indicação de R$ 4.000 (payout `98790e60`, ainda PENDING) foi pago de forma manual em 10/06 como se fosse repasse semanal (payout `66b986e1`, tipo `partnership_weekly_repass`, R$ 4.000). Depois foram pagos dois saques de R$ 4.000 (15/06 e 22/06) mais R$ 2.950 e R$ 450, totalizando saques acima do que foi creditado no contrato.

Resultado: déficit de R$ 2.200 no contrato. Os repasses semanais recentes (13/07 R$ 525, 20/07 R$ 500, 27/07 R$ 250, 03/08 R$ 525 = R$ 1.800) estão sendo absorvidos por esse déficit e por isso não aparecem como disponíveis.

Em paralelo, o mesmo bônus de R$ 4.000 foi migrado em 30/07 para a nova Carteira de Rede — é o valor azul que ela vê. Como o bônus já havia sido pago em 10/06 via contrato, esse saldo de rede é uma **duplicidade**.

## Opções de correção (precisa da sua decisão)

1. **Regularizar as duas pontas (recomendado)**
   - Estornar os R$ 4.000 duplicados da carteira de rede (lançamento de ajuste, sem apagar histórico) e marcar o payout `98790e60` como PAID/liquidado em 10/06.
   - Lançar um crédito de correção de R$ 2.200 no contrato para zerar o déficit, de modo que os repasses semanais voltem a ficar disponíveis normalmente.
   - Efeito para a Géssica: Bônus de Rede volta a R$ 0,00 (já foi pago) e Repasses passam a mostrar o acumulado das últimas semanas.

2. **Regularizar só o contrato**
   - Crédito de correção de R$ 2.200 no contrato e manter os R$ 4.000 na carteira de rede.
   - Efeito: ela receberia R$ 4.000 duas vezes pelo mesmo bônus (não recomendado).

3. **Congelar**
   - Bloquear o saque da carteira de rede dela até decisão, sem alterar nada agora.

## Detalhes técnicos

- Fonte do valor exibido: RPC `partner_get_withdrawal_balances` → `repass_available = max(0, credited − withdrawn − reserved)`.
- Consumido pelo hook `useWithdrawalBalances` e renderizado em `WithdrawalBalancesBreakdown.tsx`. Nenhuma alteração de UI é necessária — o problema é de dados.
- Qualquer correção será feita por lançamentos de ajuste auditáveis (`partner_manual_credits` / `partner_network_wallet_transactions`), sem deletar registros históricos.
