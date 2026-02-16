

## Correcao da Exclusao de Usuarios

### Problema
A funcao `deleteUser` no `AdminUserManagement.tsx` faz apenas um **soft delete** (marca `is_blocked = true`), mas nao remove o usuario de fato. Alem disso, a query que carrega a lista de usuarios no `AdminDashboard.tsx` nao filtra usuarios marcados como deletados, entao eles continuam aparecendo normalmente.

### Solucao

Criar uma edge function que faz a exclusao real do usuario (removendo de `auth.users` via service role), deletar os dados relacionados, e atualizar o frontend para chamar essa edge function.

---

### Etapa 1 - Criar Edge Function `admin-delete-user`

Criar `supabase/functions/admin-delete-user/index.ts` que:

1. Verifica que o solicitante e admin (via token JWT + consulta ao `profiles`)
2. Deleta registros relacionados ao usuario nas tabelas filhas (bids, bid_purchases, orders, affiliate data, partner contracts, etc.)
3. Deleta o perfil da tabela `profiles`
4. Deleta o usuario de `auth.users` usando `supabase.auth.admin.deleteUser()`
5. Registra a acao no audit log

A edge function usara o `SUPABASE_SERVICE_ROLE_KEY` (ja disponivel automaticamente) para executar operacoes administrativas.

### Etapa 2 - Atualizar `AdminUserManagement.tsx`

Alterar a funcao `deleteUser` para:
- Chamar a edge function `admin-delete-user` via `supabase.functions.invoke()`
- Em vez de fazer soft delete no `profiles`, delegar a exclusao completa para o backend
- Manter o toast de sucesso/erro e a chamada `onUserUpdated()` para atualizar a lista

### Etapa 3 - Nenhuma alteracao na query de listagem

Como o usuario sera efetivamente removido do banco, a query existente no `AdminDashboard.tsx` naturalmente nao retornara mais o usuario deletado. Nao e necessario alterar o filtro.

---

### Detalhes Tecnicos

**Edge Function - Ordem de exclusao (respeitar foreign keys):**

```text
1. bids (user_id)
2. bid_purchases (user_id)
3. orders (winner_id)
4. affiliate_commissions (via affiliates.user_id)
5. affiliate_referrals (via affiliates.user_id)
6. affiliate_withdrawals (via affiliates.user_id)
7. affiliate_cpa_goals (via affiliates.user_id)
8. affiliates (user_id)
9. partner_referral_bonuses (referred_user_id)
10. partner_contracts e tabelas dependentes
11. profiles (user_id)
12. auth.users (id) via admin API
```

**Frontend - Chamada:**

```typescript
const { data, error } = await supabase.functions.invoke('admin-delete-user', {
  body: { userId: user.user_id }
});
```

### Resultado Esperado

- Ao clicar em "Deletar Usuario", o usuario sera completamente removido do sistema
- A lista de usuarios sera atualizada automaticamente sem o usuario deletado
- Registros relacionados (lances, compras, etc.) serao removidos para evitar dados orfaos
- Acao registrada no audit log para rastreabilidade
