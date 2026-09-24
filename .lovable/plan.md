# Registrar o pagamento manual de R$ 1.125 do Gustavo Felipe Freire Lima

## Situação
- O pagamento manual de R$ 1.125 foi feito fora do sistema e ainda não está registrado.
- A carteira de Bônus de Rede dele continua mostrando R$ 1.625 disponíveis.
- Na segunda 28/09, ele conseguiria sacar esses R$ 1.125 de novo.
- Motivo do bloqueio na segunda 21/09: o saque de R$ 12.000 ficou "Aguardando Pagamento" até 09:55. O sistema só aceita um pedido em aberto por vez, então o botão ficou travado até esse horário.

## O que será feito
1. Registrar um saque de Bônus de Rede de R$ 1.125, sem taxa, já com status "Pago", com a observação "Pagamento manual pelo admin em 24/09/2026 (saque não disponibilizado em 21/09)".
2. Tirar R$ 1.125 da carteira dele com um lançamento de débito no extrato. Depois disso:
   - Disponível: R$ 500 (o bônus liberado em 22/09)
   - Total sacado: R$ 23.625
3. Os repasses (R$ 2.385) continuam iguais.
4. Conferir que o painel dele mostra R$ 500 de bônus e que o pagamento aparece no histórico de saques como "Pago".

Nenhuma tela ou regra será alterada.

## Detalhes técnicos
- Uma única transação de dados, sem mudar a estrutura do banco:
  - Insere em `partner_withdrawals` (contrato 11e9cbc8…, `balance_source='network_bonus'`, `bonus_amount=1125`, `fee_amount=0`, `net_amount=1125`, `status='PAID'`, `paid_at=now()`, `payment_details` com `paid_via: 'manual_admin'`).
  - Atualiza `partner_network_wallets`: `available_balance` de 1625 para 500 e `total_withdrawn` de 22500 para 23625.
  - Insere em `partner_network_wallet_transactions` um débito `withdrawal_settlement` (antes 1625, depois 500).
- Antes de gravar, revisar os triggers e os caminhos oficiais já existentes para que o saldo não seja debitado duas vezes.
- Depois, validar com `partner_get_withdrawal_balances`.
