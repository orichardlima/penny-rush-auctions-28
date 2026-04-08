

# Corrigir bônus inconsistentes do Paulo Mota e auditar outros casos

## Problema

Dois bônus do Paulo foram gerados enquanto ele estava `overdue` (desde 06/04) mas com status incorreto:

1. **Tiago upgrade (R$1.800,12)** -- status AVAILABLE. Foi inserção manual retroativa que não verificou inadimplência.
2. **Henrique L2 (R$199,98)** -- status PENDING com available_at 14/04. O trigger na época ainda não verificava financial_status (foi corrigido depois).

O bônus do José Adelino (R$1.000,00) está corretamente SUSPENDED, pois foi gerado após a correção do trigger.

## Ações

### 1. Corrigir os 2 bônus via INSERT tool (UPDATE)

**Tiago upgrade (id: `161bbb9e-...`):**
```sql
UPDATE partner_referral_bonuses
SET status = 'SUSPENDED',
    available_at = NULL,
    suspended_expires_at = NOW() + INTERVAL '3 days'
WHERE id = '161bbb9e-ab91-4536-9831-77c3e69fe226';
```

**Henrique L2 (id: `b8d00dac-...`):**
```sql
UPDATE partner_referral_bonuses
SET status = 'SUSPENDED',
    available_at = NULL,
    suspended_expires_at = NOW() + INTERVAL '3 days'
WHERE id = 'b8d00dac-0270-4cab-9c04-61fa189d5e33';
```

### 2. Auditar outros parceiros inadimplentes

Buscar todos os bônus gerados com status PENDING ou AVAILABLE onde o referrer_contract tem financial_status != 'paid', para identificar se há mais inconsistências além do Paulo.

### 3. Nenhuma alteração de trigger necessária

O trigger `ensure_partner_referral_bonuses` já verifica `financial_status` corretamente (confirmado no código atual). O problema foi apenas com bônus gerados antes da correção ou inseridos manualmente.

## Impacto

- 2 registros corrigidos para SUSPENDED com 3 dias para regularização
- Se Paulo pagar dentro de 3 dias, os bônus serão convertidos para PENDING
- Caso contrário, o pg_cron os cancelará automaticamente
- Nenhum código alterado

