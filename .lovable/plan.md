

# Fix: Creditar 50 lances do Jose Alcanjo + Análise do erro Asaas

## Diagnóstico do erro no screenshot

O erro 500 no webhook `partner-payment-webhook` ocorreu em **2026-03-19 17:58:52** -- isso foi **antes** da nossa correção de constraint ser aplicada. Ou seja, foi exatamente o bug que já corrigimos (unique constraint em `partner_referral_bonuses`).

Após a correção, o contrato do Jose Alcanjo foi ativado com sucesso via Admin (18:00:48), e todos os bônus de referral foram inseridos corretamente (incluindo Fast Start). **O webhook do Asaas não precisa de alteração** -- o erro foi pontual e já está resolvido.

## Problema pendente: 50 lances ainda não creditados

A migration que criamos (`bids_balance + 50`) não teve efeito porque o trigger `protect_profile_sensitive_fields` bloqueia alterações em `bids_balance` quando o `role` não é `service_role`. Migrations rodam como superuser (postgres), não como service_role, então o trigger reverte o valor.

## Correção

Nova migration que temporariamente desabilita a proteção para aplicar o crédito:

```sql
-- Temporariamente permitir atualização do bids_balance
SET LOCAL app.allow_sensitive_profile_update = 'true';

UPDATE profiles 
SET bids_balance = bids_balance + 50,
    updated_at = now()
WHERE user_id = '6684eb32-8e9b-4539-9792-db3bbbc5f1e8'
  AND bids_balance = 0;
```

A variável `app.allow_sensitive_profile_update` é verificada pelo trigger e permite o update quando está como `'true'`.

### Nenhuma alteração de frontend ou edge function necessária

O webhook já está funcionando corretamente após a correção anterior do constraint.

