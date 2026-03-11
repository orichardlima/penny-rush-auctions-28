

## Plano: Corrigir `is_demo` ausente no objeto `PartnerContract`

### Causa raiz
O campo `is_demo` é retornado pelo Supabase (`select('*')`), mas na linha 189 de `usePartnerContract.ts` o objeto `contractWithSponsor` é construído manualmente campo a campo — e `is_demo` **não é incluído**. Por isso `(contract as any)?.is_demo` sempre retorna `undefined`, e todas as sinalizações visuais não aparecem.

### Correção

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePartnerContract.ts` | Adicionar `is_demo: boolean` à interface `PartnerContract` (linha ~70) |
| `src/hooks/usePartnerContract.ts` | Adicionar `is_demo: data.is_demo ?? false` ao objeto `contractWithSponsor` (linha ~213) |
| `src/components/Partner/PartnerDashboard.tsx` | Remover cast `as any` — usar `contract?.is_demo` diretamente |

Duas linhas no hook, uma no dashboard. Nenhuma migration necessária.

