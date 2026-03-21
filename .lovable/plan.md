

# Correção definitiva: crédito automático de lances bônus via trigger no banco

## Causa raiz

O trigger `protect_profile_sensitive_fields` bloqueia silenciosamente atualizações em `bids_balance` quando a operação não é feita pelo `service_role`. O painel admin roda no browser como `anon`, então toda tentativa de creditar lances via frontend é **ignorada sem erro**. Isso afeta:

- Ativação manual pelo admin (`AdminUserManagement.tsx`)
- Ativação via sponsor (`sponsor-activate-partner` edge function — esta usa service_role, mas depende de lógica separada)
- Webhook do Asaas (`partner-payment-webhook` — usa service_role, mas se falhar por constraint ou outro erro, os lances se perdem)

## Solução: trigger no banco de dados

Criar um trigger `AFTER INSERT ON partner_contracts` com `SECURITY DEFINER` que credita automaticamente os lances bônus no perfil quando um contrato ACTIVE é criado com `bonus_bids_received > 0`.

Isso garante que **independente de como o contrato é criado** (admin, webhook, sponsor, migration), os lances são sempre creditados.

## Mudanças

### 1. Migration SQL

```sql
-- Função que credita lances bônus automaticamente
CREATE OR REPLACE FUNCTION credit_partner_bonus_bids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' 
     AND NEW.bonus_bids_received > 0 
     AND NEW.is_demo = false THEN
    
    UPDATE profiles
    SET bids_balance = bids_balance + NEW.bonus_bids_received,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger no INSERT
CREATE TRIGGER trg_credit_bonus_bids_on_contract
AFTER INSERT ON partner_contracts
FOR EACH ROW
EXECUTE FUNCTION credit_partner_bonus_bids();

-- Corrigir Tiago Vieira (caso pendente)
UPDATE profiles
SET bids_balance = bids_balance + 1200,
    updated_at = now()
WHERE user_id = 'fadb0e25-821c-4dd5-bb48-32d25efbec14'
  AND bids_balance = 0;
```

O `SECURITY DEFINER` faz a função executar como owner (postgres), contornando o trigger de proteção.

### 2. Remover crédito duplicado do frontend (`AdminUserManagement.tsx`)

Remover as linhas 461-478 que tentam creditar `bids_balance` e `bonus_bids_received` manualmente — o trigger agora faz isso. Manter apenas o insert do contrato com `bonus_bids_received` já preenchido.

### 3. Remover crédito duplicado do webhook (`partner-payment-webhook`)

Remover os blocos que fazem `update profiles set bids_balance` (linhas 139-158 e 203-221) — o trigger cuida disso no momento do INSERT do contrato. Manter apenas o `bonus_bids_received` no insert do contrato.

### 4. Remover crédito duplicado do sponsor-activate (`sponsor-activate-partner`)

Remover o bloco de linhas 200-216 que credita manualmente — o trigger cuida disso.

## Resultado

| Antes | Depois |
|---|---|
| 4 locais diferentes tentam creditar lances | 1 trigger centralizado no banco |
| Frontend falha silenciosamente (trigger de proteção) | Trigger SECURITY DEFINER contorna proteção |
| Falhas parciais perdem lances | Crédito é atômico com criação do contrato |
| Correções manuais por migration | Nunca mais necessário |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Trigger `credit_partner_bonus_bids` + correção Tiago |
| `src/components/AdminUserManagement.tsx` | Remover crédito manual de bids_balance |
| `supabase/functions/partner-payment-webhook/index.ts` | Remover crédito manual de bids_balance |
| `supabase/functions/sponsor-activate-partner/index.ts` | Remover crédito manual de bids_balance |

