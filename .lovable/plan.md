

# Fix: Lances dados sem consumir créditos

## Causa raiz

A migration mais recente (`20260322`) sobrescreveu a função `protect_profile_fields()` e **removeu** a verificação da flag de sessão `app.allow_sensitive_profile_update`. A versão anterior (`20260318`) verificava essa flag para permitir que `place_bid` alterasse o `bids_balance`.

```text
Fluxo atual (quebrado):
1. place_bid() seta flag 'app.allow_sensitive_profile_update' = 'true'
2. place_bid() faz UPDATE profiles SET bids_balance = bids_balance - 1
3. Trigger protect_profile_fields() dispara
4. Trigger ignora a flag (código removido) → verifica current_setting('role') e is_admin_user()
5. Usuário não é admin nem service_role → bids_balance é revertido para OLD.bids_balance
6. Lance é inserido mas saldo não muda
```

## Correção

Uma única migration para restaurar a verificação da flag de sessão na função `protect_profile_fields`, mantendo também a verificação `is_admin_user` que foi adicionada na migration mais recente.

### Nova `protect_profile_fields()`:

```sql
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) != 'service_role'
     AND coalesce(current_setting('app.allow_sensitive_profile_update', true), '') != 'true'
     AND NOT is_admin_user(auth.uid())
  THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  RETURN NEW;
END;
$$;
```

Mudanças vs versão atual:
- Adiciona `current_setting('role', true)` com o parâmetro `true` (evita erro se variável não existir)
- Restaura check da flag `app.allow_sensitive_profile_update`
- Mantém `is_admin_user()` da versão recente

## Arquivo

| Arquivo | Ação |
|---|---|
| `supabase/migrations/new_fix.sql` | Nova migration com a função corrigida |

## Resultado

`place_bid` volta a funcionar: seta a flag → trigger permite a alteração → `bids_balance` é decrementado corretamente.

