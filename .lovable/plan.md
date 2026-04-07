

# Expiração automática de bônus suspensos por inadimplência

## Conceito

Quando um parceiro inadimplente gera um bônus de indicação, ele é criado com status `SUSPENDED`. O parceiro tem um prazo de **3 dias** para regularizar. Se não regularizar dentro do prazo, o bônus é automaticamente convertido para `CANCELLED` (perdido definitivamente). Se regularizar a tempo, o bônus volta para `PENDING` com carência normal de 7 dias.

## Fluxo

```text
Parceiro inadimplente indica alguém
  └─> Bônus criado com status SUSPENDED + expires_at = NOW() + 3 dias
        ├─> Regularizou antes de 3 dias? → SUSPENDED → PENDING (carência 7d)
        └─> Não regularizou em 3 dias?   → SUSPENDED → CANCELLED (perdido)
```

## Alterações

### 1. Migration SQL

**a) Adicionar coluna `suspended_expires_at`** na tabela `partner_referral_bonuses` — timestamp que indica quando o bônus suspenso expira e é cancelado.

**b) Alterar `ensure_partner_referral_bonuses`** — ao criar bônus com status `SUSPENDED`, preencher `suspended_expires_at = NOW() + INTERVAL '3 days'`.

**c) Alterar trigger `unsuspend_bonuses_on_payment`** — ao regularizar, só converter bônus `SUSPENDED` que ainda NÃO expiraram (`suspended_expires_at > NOW()`). Limpar o campo `suspended_expires_at` ao converter.

**d) Criar função `expire_suspended_bonuses()`** — executada por cron (a cada hora), cancela bônus `SUSPENDED` cujo `suspended_expires_at <= NOW()`:
```sql
UPDATE partner_referral_bonuses
SET status = 'CANCELLED'
WHERE status = 'SUSPENDED' AND suspended_expires_at <= NOW();
```

**e) Agendar cron job** — `pg_cron` executando `expire_suspended_bonuses()` a cada hora.

### 2. Frontend — `src/hooks/usePartnerReferrals.ts`

- Adicionar campo `suspended_expires_at` ao tipo `PartnerReferralBonus`
- Atualizar `getStatusLabel` para SUSPENDED: mostrar "Suspenso (expira em X dias)" quando houver `suspended_expires_at`
- Adicionar contagem de `cancelled` nas stats

### 3. Prazo configurável (opcional futuro)

O prazo de 3 dias fica hardcoded na function SQL por simplicidade. Se no futuro quiser tornar configurável, pode ser adicionado a uma tabela de configuração.

## Resumo de arquivos

| Tipo | Descrição |
|------|-----------|
| Migration SQL | Nova coluna + alteração de functions + cron job |
| Frontend | `src/hooks/usePartnerReferrals.ts` — exibir prazo de expiração |

## Impacto

- Bônus de inadimplentes expiram automaticamente em 3 dias
- Incentiva regularização rápida
- Bônus perdidos não podem ser recuperados (CANCELLED é definitivo)
- Pontos binários continuam propagando (estrutura da rede)
- Nenhuma mudança na UI além do label atualizado

