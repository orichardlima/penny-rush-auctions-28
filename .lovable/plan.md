

# Plano: Corrigir dados ocultos nos painéis de parceiros

## Problema

A restrição RLS em `partner_contracts` (apenas `auth.uid() = user_id`) impede que parceiros vejam o **plano** e **pontos** dos seus indicados. Isso afeta:

| Componente | Dado oculto | Resultado visível |
|---|---|---|
| `usePartnerReferrals.ts` | plan_name dos contratos indicados | Coluna "Plano" mostra "-" |
| `usePartnerReferrals.ts` | Pontos derivados do plano | Coluna "Pontos" mostra "+0" |
| `useReferralNetwork.ts` | plan_name + profiles dos indicados | Árvore mostra "-" e "Usuário" |

## Solução

### 1. Nova função SQL `get_referred_contracts_info`

Função SECURITY DEFINER que retorna apenas `id, plan_name` de contratos por array de IDs — sem expor PIX, saldos ou dados financeiros.

```sql
CREATE OR REPLACE FUNCTION public.get_referred_contracts_info(contract_ids uuid[])
RETURNS TABLE(id uuid, plan_name text, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.plan_name, c.user_id
  FROM public.partner_contracts c
  WHERE c.id = ANY(contract_ids);
$$;
```

### 2. Atualizar `usePartnerReferrals.ts`

Trocar `supabase.from('partner_contracts').select('id, plan_name').in(...)` por `supabase.rpc('get_referred_contracts_info', { contract_ids: [...] })`.

### 3. Atualizar `useReferralNetwork.ts`

- Trocar query de `partner_contracts` por mesma RPC
- Trocar query direta de `profiles` por `get_public_profiles` RPC (já existente)

### 4. Registrar tipo em `types.ts`

Adicionar assinatura da nova função.

## Resultado

- Coluna "Plano" volta a mostrar o nome do plano (START, PRO, etc.)
- Coluna "Pontos" volta a calcular corretamente baseado no plano
- Árvore de indicações exibe nomes e planos
- Nenhum dado sensível exposto (PIX, saldos, bank_details continuam protegidos)

