

# Plano: Corrigir dados ocultos para usuários legítimos

## Diagnóstico

A política RLS de `profiles` atual permite que usuários autenticados vejam **apenas seu próprio perfil**. Isso quebra **6 funcionalidades** onde um usuário precisa ver o nome de outro:

| Componente | O que está oculto | Quem é afetado |
|---|---|---|
| `AffiliateReferralsList.tsx` | Nomes dos indicados do afiliado | Afiliados |
| `useReferralBonuses.ts` | Nomes dos referidos nos bônus | Afiliados |
| `usePartnerReferrals.ts` | Nomes dos indicados do parceiro | Parceiros |
| `usePartnerContract.ts` | Nome do patrocinador | Parceiros |
| `UserProfileCard.tsx` | Nome do patrocinador (quem indicou) | Todos os usuários |
| `useDailyPayoutPreview.ts` | Nomes dos parceiros no preview | Admin (funciona via policy admin) |

Os hooks de admin (`useAdminAffiliates`, `useAffiliateManager`, `usePartnerCashflow`, `AdminDashboard`) **já funcionam** porque a policy `Admins can manage all profiles` os cobre.

## Solução

Criar uma função SQL `get_public_profiles` (bulk) — similar à `get_public_profile` que já existe mas aceita apenas 1 ID — e atualizar os 5 componentes afetados para usá-la via RPC.

### 1. Migração SQL — Função bulk `get_public_profiles`

```sql
CREATE OR REPLACE FUNCTION public.get_public_profiles(user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(user_ids);
$$;
```

Essa função bypassa RLS com SECURITY DEFINER mas expõe apenas dados públicos (nome e avatar).

### 2. Atualizar 5 componentes do frontend

Cada componente que faz `supabase.from('profiles').select('full_name').in('user_id', ...)` será alterado para usar `supabase.rpc('get_public_profiles', { user_ids: [...] })`.

**Arquivos a editar:**

- **`src/components/Affiliate/AffiliateReferralsList.tsx`** (linha 83-87) — trocar query profiles por RPC
- **`src/hooks/useReferralBonuses.ts`** (linha 43-46) — trocar query profiles por RPC
- **`src/hooks/usePartnerReferrals.ts`** (linha 117-120) — trocar query profiles por RPC
- **`src/hooks/usePartnerContract.ts`** (linha 171-175) — trocar para `get_public_profile` (single, já existe)
- **`src/components/UserProfileCard.tsx`** (linha 137-141) — trocar para `get_public_profile` (single)

### 3. Registrar tipo em `types.ts`

A assinatura de `get_public_profiles` será adicionada automaticamente via regeneração do tipo Supabase ao aplicar a migração.

### Resultado

- Nomes dos indicados, referidos e patrocinadores voltam a aparecer para todos os usuários
- Nenhum dado sensível (email, CPF, saldo) é exposto — apenas `full_name` e `avatar_url`
- Segurança mantida: a tabela `profiles` continua protegida por RLS restritivo

