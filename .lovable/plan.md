

# Fix: Nomes reais no Caixa Financeiro (PartnerCashflowDashboard)

## Problema

No `usePartnerCashflow.ts` (linha 109), a query `supabase.from('profiles').select('user_id, full_name')` tenta ler **todos** os perfis diretamente, mas a tabela `profiles` tem RLS restritivo que impede leitura de perfis de outros usuários. O resultado volta vazio, e todos os nomes caem nos fallbacks `'Parceiro'` e `'Indicado'`.

## Solução

Substituir a query direta à tabela `profiles` pela RPC `get_public_profiles` (SECURITY DEFINER), que já existe e contorna o RLS.

### Arquivo: `src/hooks/usePartnerCashflow.ts`

1. Remover a query `supabase.from('profiles').select(...)` do `Promise.all`
2. Após receber os dados, coletar todos os `user_id`s necessários (dos contratos + `referred_user_id` dos bônus)
3. Chamar `supabase.rpc('get_public_profiles', { user_ids: allUserIds })`
4. Montar o `profilesMap` a partir do resultado da RPC

A mudança é interna ao hook -- nenhuma alteração na UI ou em outros arquivos.

