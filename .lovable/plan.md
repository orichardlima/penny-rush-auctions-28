

# Gerar bônus de indicação para upgrades administrativos de plano

## Problema atual

Quando o admin faz upgrade de plano, o código atualiza os bônus existentes com o novo `aporte_value` e `bonus_value`. Mas se esses bônus já foram pagos ou estão disponíveis, o upline não recebe a diferença — ele simplesmente já recebeu pelo valor antigo.

## Solução

Substituir a lógica de "recalcular bônus existentes" por "criar novos bônus com a diferença do aporte". Assim o upline recebe um bônus adicional proporcional à diferença.

## Alteração

**1 arquivo**: `src/hooks/useAdminPartners.ts` — função `upgradeContractPlan`

Substituir o bloco de recálculo de bônus (linhas ~1697-1712) por:

1. Calcular `aporteDiff = newAporte - oldAporte`
2. Buscar a cadeia de referral do contrato (nível 1: `referred_by_user_id`, nível 2 e 3: subindo pela cadeia)
3. Para cada upline encontrado:
   - Buscar a porcentagem de bônus (nível 1: do plano do upline via `referral_bonus_percentage`; nível 2/3: via `referral_level_config`)
   - Verificar `financial_status` do upline para definir status (`PENDING` vs `SUSPENDED`)
   - Inserir novo registro em `partner_referral_bonuses` com `aporte_value = aporteDiff`, `bonus_value = aporteDiff * percentage / 100`
   - Usar `is_fast_start_bonus = false` e gerar novo `id` (não depende do unique constraint)
4. Atualizar `total_referral_points` dos uplines com a diferença de pontos proporcional

### Contorno do unique constraint

O unique constraint é `(referred_contract_id, referral_level, is_fast_start_bonus)`. Como já existe um bônus para o contrato + nível, será necessário:
- **Opção escolhida**: Criar uma migration para alterar o unique constraint, adicionando um campo que permita múltiplos bônus por contrato/nível (ex: adicionar coluna `source_event` como parte do constraint), OU
- Usar a abordagem de UPDATE no valor (somar a diferença ao bonus_value existente) para bônus que ainda estão PENDING

**Abordagem recomendada**: Somar a diferença ao `bonus_value` dos bônus existentes que estão em `PENDING` ou `SUSPENDED`. Para bônus já `AVAILABLE` ou `PAID`, não alterar (já foram processados). Nesse caso, criar um novo bônus requer alterar o constraint.

**Abordagem mais simples e segura**: Alterar o unique constraint para incluir um campo `source_event` (TEXT, default `'activation'`), permitindo bônus separados para `'activation'` e `'upgrade'`.

## Arquivos

| Tipo | Descrição |
|------|-----------|
| Migration SQL | Adicionar coluna `source_event` (TEXT DEFAULT 'activation') + alterar unique constraint para `(referred_contract_id, referral_level, is_fast_start_bonus, source_event)` |
| Frontend | `src/hooks/useAdminPartners.ts` — reescrever bloco de recálculo para inserir novos bônus com `source_event = 'upgrade'` |

## Lógica detalhada no frontend

```text
aporteDiff = newAporte - oldAporte  (ex: 20000 - 9999 = 10001)

Para cada upline (nível 1, 2, 3):
  bonusValue = aporteDiff * percentage / 100
  
  INSERT partner_referral_bonuses:
    aporte_value: aporteDiff
    bonus_value: bonusValue
    source_event: 'upgrade'
    status: PENDING (se upline paid) ou SUSPENDED (se inadimplente)
    available_at: NOW() + 7 days (se PENDING)
    suspended_expires_at: NOW() + 3 days (se SUSPENDED)
```

## Impacto

- Uplines recebem bônus proporcional à diferença do aporte no upgrade
- Bônus original da ativação permanece intacto
- Respeita regras de inadimplência (SUSPENDED com expiração de 3 dias)
- Pontos binários já são propagados (lógica existente, mantida)

