

# Corrigir bônus de indicação do João Batista (2 cotas) + prevenção futura

## Problema

Os 3 bônus de indicação gerados pela ativação do João Batista foram calculados sobre R$ 9.999 (1 cota), mas ele tem 2 cotas (R$ 19.998). Valores atuais vs corretos:

| Nível | % | Valor atual | Valor correto |
|---|---|---|---|
| 1 (Abraão) | 12% | R$ 1.199,88 | R$ 2.399,76 |
| 2 | 2% | R$ 199,98 | R$ 399,96 |
| 3 | 0.5% | R$ 49,99 | R$ 99,99 |

## Solução

### 1. Correção retroativa (SQL via insert tool)

Atualizar os 3 registros na tabela `partner_referral_bonuses` com os valores corretos:

```sql
UPDATE partner_referral_bonuses SET aporte_value = 19998, bonus_value = 2399.76 WHERE id = '363edf42-...'; -- Nível 1
UPDATE partner_referral_bonuses SET aporte_value = 19998, bonus_value = 399.96  WHERE id = 'e190e577-...'; -- Nível 2
UPDATE partner_referral_bonuses SET aporte_value = 19998, bonus_value = 99.99   WHERE id = '7e02ae51-...'; -- Nível 3
```

### 2. Prevenção futura: recalcular bônus no upgrade de cotas

Na função `upgradeContractCotas` em `src/hooks/useAdminPartners.ts`, após propagar pontos binários, adicionar recálculo dos bônus de indicação:

```typescript
// Recalcular bônus de indicação proporcionais às novas cotas
const { data: existingBonuses } = await supabase
  .from('partner_referral_bonuses')
  .select('id, bonus_percentage')
  .eq('referred_contract_id', contractId)
  .eq('is_fast_start_bonus', false);

if (existingBonuses?.length) {
  for (const bonus of existingBonuses) {
    const newBonusValue = newAporte * (bonus.bonus_percentage / 100);
    await supabase
      .from('partner_referral_bonuses')
      .update({ aporte_value: newAporte, bonus_value: newBonusValue })
      .eq('id', bonus.id);
  }
}
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Banco (UPDATE via insert tool) | Corrigir os 3 bônus existentes |
| `src/hooks/useAdminPartners.ts` | Adicionar recálculo de bônus na função `upgradeContractCotas` |

