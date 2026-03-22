

# Fix: Admin não consegue alterar saldo de lances manualmente

## Causa raiz

O trigger `protect_profile_sensitive_fields` (linha 17) força `NEW.bids_balance := OLD.bids_balance` para qualquer role que não seja `service_role`. O painel admin roda no browser como `anon`/`authenticated`, então toda alteração manual de saldo é **silenciosamente ignorada**.

## Solução

Alterar a função `protect_profile_fields()` para permitir updates quando o usuário autenticado é admin:

```sql
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') != 'service_role' 
     AND NOT is_admin_user(auth.uid()) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  RETURN NEW;
END;
$$;
```

Isso permite que admins alterem `bids_balance`, `is_blocked` e `is_admin` pelo painel, enquanto usuários normais continuam bloqueados.

## Correção manual do Deivide

Creditar o saldo correto via migration (informar quantos lances foram comprados para eu incluir na migration).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Atualizar `protect_profile_fields()` para permitir admins |

