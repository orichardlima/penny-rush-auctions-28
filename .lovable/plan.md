

# Correção: Aba de compras não carrega dados

## Problema

Na linha 62 do `RecentPurchasesTab.tsx`, o query usa:
```
profiles!bid_purchases_user_id_fkey(full_name)
```
Mas `bid_purchases.user_id` tem FK para `auth.users`, não para `profiles`. O PostgREST não consegue resolver esse join e a query falha silenciosamente — resultado: nenhuma compra aparece.

## Solução

Remover o join quebrado e buscar os nomes dos usuários em uma query separada.

### Arquivo: `src/components/AdminDashboard/RecentPurchasesTab.tsx`

1. Remover `profiles!bid_purchases_user_id_fkey(full_name)` do select
2. Após buscar as compras, coletar os `user_id`s únicos e buscar nomes na tabela `profiles`
3. Mapear os nomes de volta nas linhas da tabela

| Arquivo | Mudança |
|---|---|
| `src/components/AdminDashboard/RecentPurchasesTab.tsx` | Separar query de compras e nomes de usuários |

