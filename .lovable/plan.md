# Saque do Bônus de Rede no painel do parceiro

## Situação atual (verificada)

- O painel do parceiro mostra **duas carteiras** (Repasses da Parceria e Bônus de Rede) em `WithdrawalBalancesBreakdown`, inclusive dentro do modal de saque.
- Porém o botão **Solicitar Saque** só trabalha com o saldo de **repasses do contrato**: o hook `usePartnerWithdrawals` faz um `INSERT` direto em `partner_withdrawals` sem informar a origem do saldo, e valida o valor apenas contra o saldo de repasses.
- O backend já está pronto: existe a função `partner_request_withdrawal(_amount, _source, _payment_details, _client_request_id, _contract_id)` com suporte a origem (`repass`, `bonus`, `mixed`), além das tabelas `withdrawal_allocations` e das colunas `balance_source`, `repass_amount`, `bonus_amount` em `partner_withdrawals`.
- Histórico confirma: 71 saques `partnership_repass` e apenas 1 `mixed` (esse não veio pela tela).

Consequência prática: o Gustavo (e qualquer parceiro) **vê** os R$ 5.000 de Bônus de Rede, mas não tem como solicitá-los pela interface — só o saldo de repasses é sacável hoje.

## O que será feito

1. **Seleção de origem no modal de saque**
   - Adicionar no modal "Solicitar Saque" a escolha da origem: Repasses da Parceria, Bônus de Rede ou Ambos.
   - O valor máximo e o botão "Usar saldo total" passam a respeitar a origem escolhida.
   - Manter o layout atual dos dois cartões de origem; a origem selecionada fica destacada.

2. **Usar o backend oficial**
   - Trocar o `INSERT` direto pela chamada de `partner_request_withdrawal`, passando `_source` conforme a seleção, com `_client_request_id` para evitar duplicidade em duplo-clique.
   - Manter as validações atuais (saque pendente, valor mínimo, pendência financeira, janela de saque, taxa/Segunda Taxa Zero).

3. **Histórico com origem**
   - Nova coluna "Origem" no histórico de saques, exibindo Repasse / Bônus de Rede / Misto a partir de `balance_source`, com a quebra de valores no diálogo de detalhes.

4. **Regras preservadas**
   - Saque de Bônus de Rede **não consome o teto do contrato** (continua independente dos repasses).
   - Nenhuma alteração em cálculo de bônus, carência de 7 dias, teto, comissões ou rotinas automáticas.

## Detalhes técnicos

- Arquivos: `src/components/Partner/PartnerWithdrawalSection.tsx` (UI/modal/histórico), `src/hooks/usePartnerWithdrawals.ts` (chamada RPC + validação por origem), `src/components/Partner/PartnerWithdrawalDetailsDialog.tsx` (quebra repasse/bônus).
- Nenhuma migration nova prevista; se a RPC exigir ajuste de permissão/validação, será feito de forma aditiva, sem alterar regras financeiras.
- Verificação final: solicitar um saque de teste de cada origem em ambiente de preview e conferir `balance_source`, `repass_amount` e `bonus_amount` gravados corretamente.
