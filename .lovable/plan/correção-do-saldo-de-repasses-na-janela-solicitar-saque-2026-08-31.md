# Correção do saldo de Repasses na janela "Solicitar Saque"

## O que os prints mostram

- Card **Repasses da Parceria**: R$ 250,00 disponível (correto)
- Card **Bônus de Rede**: R$ 1.964,82 disponível — total recebido R$ 10.974,82, sacado R$ 9.010,00 (correto)
- Janela **Solicitar Saque**: "REPASSES DA PARCERIA — R$ 0,00" (incorreto)

Os dois cards batem exatamente com a fonte oficial de saldos do banco. O valor R$ 0,00 dentro do modal é que está errado.

## Causa confirmada

O modal não usa a fonte oficial de saldos. Ele usa um cálculo antigo que soma **todos** os repasses pagos do contrato e subtrai **todos** os saques do contrato, sem separar a origem:

- Repasses/lançamentos pagos no contrato: R$ 6.043
- Saques lançados no contrato: R$ 10.803 (inclui dois saques "Misto", que em grande parte foram de Bônus de Rede)
- Resultado: valor negativo, exibido como R$ 0,00

Ou seja, saques de Bônus de Rede estão sendo descontados do saldo de repasses dentro do modal — exatamente o oposto da regra exibida na tela ("os dois saldos são independentes").

Consequência prática: hoje ele consegue sacar o Bônus de Rede normalmente, mas fica impedido de solicitar os R$ 250 de repasse (o mesmo cálculo antigo também é usado na validação do envio).

## O que será feito

1. No painel de saque, passar a ler o disponível de **Repasses da Parceria** direto da fonte oficial de saldos por contrato (a mesma que alimenta o card correto), em vez do cálculo antigo.
2. Usar esse mesmo valor no limite do campo "Valor do Saque", no "Usar saldo total" e na validação antes de enviar, para as origens Repasse e Misto.
3. Remover o uso do cálculo antigo apenas nesse fluxo, sem mexer em nada mais.

Nenhuma regra de negócio, valor, taxa ou layout muda. Depois do ajuste o modal deve mostrar R$ 250,00 em Repasses e R$ 1.964,82 em Bônus, permitindo o saque das duas origens.

## Detalhes técnicos

- `src/components/Partner/PartnerWithdrawalSection.tsx`: substituir `availableBalance` (de `calculateAvailableBalance`) por `currentContractBalance?.available` (já disponível via `useWithdrawalBalances`), que vem de `partner_get_withdrawal_balances`.
- `src/hooks/usePartnerWithdrawals.ts`: na pré-validação de `requestWithdrawal`, trocar o cálculo local por leitura do mesmo RPC. A validação definitiva no banco (`partner_request_withdrawal`) permanece intacta.
- `calculateAvailableBalance` permanece exportado para não quebrar outros usos; apenas deixa de governar este fluxo.
