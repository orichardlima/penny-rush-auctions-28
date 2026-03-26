

# Exibir plano e modo Demo no perfil do usuário

## Mudança

Adicionar uma query no `UserProfileCard.tsx` para buscar o contrato ativo do usuário em `partner_contracts` e exibir o tipo de plano (ex: "Legend", "Diamond"), número de cotas e se é conta Demo.

## Implementação

**No `UserProfileCard.tsx`:**

1. Adicionar uma nova query com `useQuery` para buscar `partner_contracts` do usuário:
```typescript
const { data: partnerContract } = useQuery({
  queryKey: ['user-partner-contract', userId],
  queryFn: async () => {
    const { data } = await supabase
      .from('partner_contracts')
      .select('plan_name, is_demo, cotas, status')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    return data;
  },
});
```

2. Exibir badges junto ao badge de classificação existente ("Parceiro"):
   - Badge com nome do plano: ex. "Legend" ou "Diamond"
   - Badge "Demo" se `is_demo === true`
   - Badge com cotas se > 1: ex. "2 Cotas"

Exemplo visual: `[Parceiro] [Legend] [Demo] [2 Cotas]`

## Arquivo modificado

| Arquivo | Mudança |
|---|---|
| `src/components/UserProfileCard.tsx` | Nova query para `partner_contracts` + badges de plano/demo/cotas |

