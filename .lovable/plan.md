## Problema

Hoje o cálculo do estorno desconta tudo que foi **creditado** como payout (saldo disponível), mesmo que o parceiro nunca tenha sacado para a conta bancária. Isso pune o parceiro descontando dinheiro que a empresa nunca pagou de fato.

Exemplo atual da Sabriny:
- Total recebido em payouts: R$ 5.612,50 (saldo creditado)
- Mas se ela só sacou R$ 1.000 via PIX, os outros R$ 4.612,50 ainda estão na plataforma — não saíram do caixa da empresa.

## Mudança

Trocar a fonte do "Total já recebido em payouts" no detalhamento financeiro do encerramento:

- **Antes:** soma de `partner_payouts` com `status = 'PAID'` (= valor creditado no saldo do parceiro)
- **Depois:** soma de `partner_withdrawals` com `status = 'PAID'` (= PIX efetivamente enviado para a conta bancária)

O saldo creditado mas não sacado fica como "crédito interno" do parceiro e **não** reduz o estorno.

## Onde aplicar

1. **`src/components/Partner/EncerramentoDashboard.tsx`** — bloco "Detalhamento Financeiro":
   - Renomear a linha de "Total já recebido em payouts" para **"Total já pago via PIX (saques)"**
   - Usar `totalWithdrawnPix` (soma de `partner_withdrawals.status = 'PAID'`) em vez de `contract.total_received`
   - Recalcular "Saldo restante do teto" e "Valor final do estorno" com esse novo valor:
     - `valorFinalEstorno = max(0, aporte × (1 − deságio%) − totalWithdrawnPix)`
   - Adicionar linha informativa logo abaixo: **"Saldo creditado não sacado: R$ X,XX"** (apenas exibição, não desconta do estorno) para deixar transparente.

2. **`src/hooks/useTerminationDetails.ts`** — buscar adicionalmente os saques PAID:
   - Nova query em `partner_withdrawals` (`status = 'PAID'`, `partner_contract_id`)
   - Expor `totalWithdrawnPix` e `totalCreditedNotWithdrawn` no retorno

3. **`src/hooks/usePartnerEarlyTermination.ts`** — `calculateLiquidationProposal`:
   - Aceitar parâmetro opcional `totalWithdrawnPix`; quando informado, usar no lugar de `contract.total_received` na fórmula do `proposedValue`
   - Mantém compatibilidade com chamadas existentes (dialog de solicitação continua funcionando)

4. **`src/components/Partner/PartnerEarlyTerminationDialog.tsx`** (verificar): se o dialog de solicitação também mostra a prévia, passar `totalWithdrawnPix` para o cálculo para alinhar o que o parceiro vê antes/depois de solicitar.

## Sem mudanças

- Nenhuma alteração de schema (tabelas, RLS, triggers).
- Nenhuma mudança no fluxo do admin (aprovar/marcar como pago continua igual).
- Nenhuma mudança no cálculo de saldo disponível para saque normal (`usePartnerWithdrawals.calculateAvailableBalance`) — ele continua usando payouts PAID, pois o parceiro pode sacar tudo que foi creditado.
- UI do restante do dashboard permanece intacta.

## Edge cases tratados

- Parceiro sem nenhum saque PAID → `totalWithdrawnPix = 0` → estorno = aporte × 70%.
- Parceiro com saques PENDING/APPROVED mas não PAID → ainda **não** descontam (consistente com a regra: só conta o que saiu do caixa).
- Se `totalWithdrawnPix > aporte × 70%` → estorno = R$ 0,00 (já tratado pelo `Math.max(0, …)`).
