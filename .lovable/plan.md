

# Corrigir classificação "Inativo" para contas com parceria ativa

## Problema

A badge de status ("Inativo") vem da função SQL `get_user_analytics`, que classifica usuários **apenas com base em lances em leilões**. Contas de parceria ativa (mesmo em modo demo) que nunca deram lances são marcadas como "Inativo", o que é incorreto.

## Solução

Alterar a lógica de `user_classification` na função `get_user_analytics` para considerar contratos de parceria ativos. Se o usuário tem um contrato ativo em `partner_contracts`, ele deve ser classificado como "Parceiro" (ou manter a classificação de lances se esta for superior, como VIP/Premium).

Nova lógica do CASE:
```sql
CASE 
  WHEN ... >= 10000 THEN 'VIP'
  WHEN ... >= 5000 THEN 'Premium'
  WHEN EXISTS (SELECT 1 FROM public.partner_contracts pc WHERE pc.user_id = user_uuid AND pc.status = 'active') THEN 'Parceiro'
  WHEN ... >= 10 THEN 'Ativo'
  WHEN ... > 0 THEN 'Casual'
  ELSE 'Inativo'
END
```

Também adicionar a cor do badge "Parceiro" no `UserProfileCard.tsx`:
```typescript
case 'Parceiro': return 'bg-emerald-100 text-emerald-800';
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Nova migração SQL | Recriar `get_user_analytics` com classificação "Parceiro" para contratos ativos |
| `src/components/UserProfileCard.tsx` | Adicionar cor para badge "Parceiro" + texto comportamental |

