

# Upgrade de Cotas no Mesmo Plano

## Cenario

Parceiro com 1 cota Legend quer comprar mais 1 cota (ir para 2). Paga apenas a diferenca de 1 aporte e tem seus caps recalculados proporcionalmente.

## Regras de negocio

- So pode aumentar cotas, nunca diminuir
- Maximo = `max_cotas` do plano (ex: 3 para Legend)
- Mesma restricao de progresso < 80% do teto atual
- Diferenca a pagar = `plan.aporte_value * (novas_cotas - cotas_atuais)`
- Apos pagamento: `aporte_value`, `weekly_cap`, `total_cap` sao recalculados para `plan_value * novas_cotas`
- `total_received` e preservado (nao zera)

## Mudancas

### 1. Edge Function: `partner-upgrade-payment/index.ts`
- Aceitar novo campo opcional `upgradeCotas: number` (alternativa ao `newPlanId`)
- Quando `upgradeCotas` presente:
  - Buscar plano atual pelo `plan_name` do contrato
  - Validar `upgradeCotas > contract.cotas && upgradeCotas <= plan.max_cotas`
  - Calcular diferenca: `plan.aporte_value * (upgradeCotas - contract.cotas)`
  - Gerar PIX com `externalReference = "cotas-upgrade:{contractId}:{upgradeCotas}"`

### 2. Edge Function: `partner-payment-webhook/index.ts`
- Detectar prefixo `cotas-upgrade:` no externalReference
- Ao confirmar pagamento: atualizar contrato com novos valores proporcionais e novo numero de cotas

### 3. Frontend: `PartnerUpgradeDialog.tsx`
- Adicionar aba/opcao "Aumentar Cotas" quando `contract.cotas < plan.max_cotas`
- Seletor de cotas desejadas (de `contract.cotas + 1` ate `max_cotas`)
- Exibir diferenca a pagar e novos limites
- Chamar `onUpgrade` com dados de cotas em vez de `newPlanId`

### 4. Hook: `usePartnerContract.ts`
- Adicionar funcao `upgradeCotas(contractId, newCotas)` que chama a edge function com `upgradeCotas`
- Atualizar `PartnerUpgradePaymentData` para incluir info de cotas

### 5. `PartnerDashboard.tsx`
- Exibir cotas atuais no dashboard (ex: "2/3 cotas Legend")
- Conectar botao de upgrade de cotas ao dialog

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/partner-upgrade-payment/index.ts` | Suporte a upgradeCotas |
| `supabase/functions/partner-payment-webhook/index.ts` | Processar cotas-upgrade no webhook |
| `src/components/Partner/PartnerUpgradeDialog.tsx` | Aba de upgrade de cotas |
| `src/hooks/usePartnerContract.ts` | Funcao upgradeCotas |
| `src/components/Partner/PartnerDashboard.tsx` | Exibir cotas e conectar upgrade |

