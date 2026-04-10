

# Corrigir verificação de pagamento MagenPay para parceiros

## Problema

Com o gateway ativo sendo `magenpay`, o fluxo de parceiro quebra porque:

1. O PIX é gerado corretamente via VPS MagenPay (`partner-payment` → `createDeposit`)
2. O usuário paga
3. O webhook do MagenPay pode não chegar (VPS não envia callback confiável)
4. O botão "Já fiz o pagamento" no `PartnerPixPaymentModal` apenas lê `partner_payment_intents.payment_status` do banco — nunca consulta a VPS
5. A Edge Function `magen-check-status` só sabe processar `bid_purchases`, ignora `partner_payment_intents`

Resultado: o pagamento fica eternamente "pendente" e precisa de ativação manual via admin.

## Solução

### 1. Estender `magen-check-status` para processar partner intents

Aceitar um parâmetro opcional `intentId` (além do `purchaseId` existente). Quando `intentId` for fornecido e o status na VPS for `paid`:
- Buscar o intent em `partner_payment_intents`
- Verificar se já não foi processado (idempotência)
- Criar o contrato (`partner_contracts`) com status `ACTIVE` — mesma lógica que já existe no `magen-webhook` (`processNewContractPayment`)
- Atualizar o intent para `approved`
- Creditar bids bônus se aplicável

Manter compatibilidade: se `purchaseId` for enviado, continua funcionando como antes para compras de lances.

### 2. Atualizar `PartnerPixPaymentModal` para chamar `magen-check-status`

No `checkPaymentStatus` (botão "Já fiz o pagamento"):
- Antes de apenas ler o banco, invocar `magen-check-status` com `{ txId: paymentData.paymentId, intentId }` para que o backend consulte a VPS e processe a ativação automaticamente
- Se retornar `status: 'paid'`, seguir com `handleApproved`

No polling automático (a cada 3s):
- Também chamar `magen-check-status` ao invés de só ler o banco, para que a confirmação seja detectada sem depender de webhook

### 3. Suporte a upgrades e cotas no `magen-check-status`

Aceitar parâmetro `upgradeRef` (ex: `upgrade:contractId:planId` ou `cotas-upgrade:contractId:newCotas`). Quando fornecido e VPS confirmar paid, executar a mesma lógica de upgrade do `magen-webhook`.

---

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/magen-check-status/index.ts` | Adicionar lógica para `intentId` e `upgradeRef` |
| `src/components/Partner/PartnerPixPaymentModal.tsx` | Chamar `magen-check-status` no polling e no botão |

### Segurança
- A função `magen-check-status` usa `service_role_key` no backend (já existente)
- Validação de input com checagem de `txId` obrigatório
- Idempotência mantida (verifica status antes de processar)

