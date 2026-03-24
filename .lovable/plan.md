

# Implementacao: Sistema de Cotas nos Planos de Parceiro

## Resumo

Adicionar coluna `max_cotas` nos planos e `cotas` nos contratos/intents. Legend tera `max_cotas = 3`. Os valores de aporte, caps e pontuacao binaria serao proporcionais ao numero de cotas.

## 1. Migracao SQL

Adicionar colunas e atualizar funcao de posicionamento binario:

```sql
-- Novas colunas
ALTER TABLE partner_plans ADD COLUMN max_cotas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE partner_plans ADD COLUMN monthly_return_cap NUMERIC NOT NULL DEFAULT 0.10;
ALTER TABLE partner_plans ADD COLUMN total_return_cap NUMERIC NOT NULL DEFAULT 2.0;

ALTER TABLE partner_contracts ADD COLUMN cotas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE partner_payment_intents ADD COLUMN cotas INTEGER NOT NULL DEFAULT 1;

-- Definir max_cotas = 3 para Legend
UPDATE partner_plans SET max_cotas = 3 WHERE UPPER(name) = 'LEGEND';
```

Atualizar funcao `position_partner_binary` para multiplicar pontos pelas cotas:

```sql
-- Apos buscar v_points do partner_level_points:
SELECT COALESCE(pc.cotas, 1) INTO v_cotas FROM partner_contracts pc WHERE pc.id = p_contract_id;
v_points := v_points * v_cotas;
```

## 2. Edge Functions

### `partner-payment/index.ts`
- Receber campo `cotas` (default 1)
- Validar: `cotas >= 1 && cotas <= planData.max_cotas`
- Calcular valores proporcionais:
  - `aporte_value = plan.aporte_value * cotas`
  - `weekly_cap = plan.weekly_cap * cotas`
  - `total_cap = plan.total_cap * cotas`
  - `bonus_bids = plan.bonus_bids * cotas`
- Gravar `cotas` no payment intent
- Gerar PIX pelo valor total

### `partner-payment-webhook/index.ts`
- Ao criar contrato, copiar `cotas` do intent para o contrato

### `sponsor-activate-partner/index.ts`
- Receber `cotas` (default 1)
- Validar, calcular proporcionalmente, debitar `plan.aporte_value * cotas`

## 3. Frontend

### `usePartnerContract.ts`
- Adicionar `max_cotas`, `monthly_return_cap`, `total_return_cap` ao `PartnerPlan`
- Adicionar `cotas` ao `PartnerContract`
- `createContract` recebe `cotas` e envia para edge function

### `PartnerPlanCard.tsx`
- Se `max_cotas > 1`, exibir seletor de cotas (botoes +/-) abaixo do preco
- Atualizar em tempo real: valor total, teto semanal, teto total
- `onSelect` passa `planId` e `cotas`

### `PartnerDashboard.tsx`
- Ajustar `handlePlanSelect` e `handlePlanSelectWithTerms` para receber `cotas`
- Exibir cotas no dashboard do contrato ativo (ex: "2 cotas Legend")

### `SponsorActivateDialog.tsx`
- Seletor de cotas quando plano selecionado tem `max_cotas > 1`
- Calcular valor total e validar saldo

---

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Nova migracao SQL | Colunas + atualizar `position_partner_binary` |
| `supabase/functions/partner-payment/index.ts` | Receber/validar cotas |
| `supabase/functions/partner-payment-webhook/index.ts` | Gravar cotas no contrato |
| `supabase/functions/sponsor-activate-partner/index.ts` | Suporte a cotas |
| `src/hooks/usePartnerContract.ts` | Interfaces + createContract com cotas |
| `src/components/Partner/PartnerPlanCard.tsx` | Seletor de cotas |
| `src/components/Partner/PartnerDashboard.tsx` | Passar cotas no fluxo |
| `src/components/Partner/SponsorActivateDialog.tsx` | Seletor de cotas |

