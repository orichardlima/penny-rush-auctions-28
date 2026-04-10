

# Corrigir erro ao deletar plano de parceiro

## Problema

O botão de deletar plano falha com erro de foreign key porque a lógica atual só verifica `partner_contracts` vinculados ao plano. Porém, a tabela `partner_payment_intents` também tem uma FK (`plan_id`) para `partner_plans`. Quando existem intents (mesmo expirados/pendentes) referenciando o plano, o DELETE falha.

## Solução

No `deletePlan` em `src/hooks/useAdminPartners.ts`, antes de tentar o DELETE permanente:

1. Verificar se existem `partner_payment_intents` referenciando o `planId`
2. Se existirem intents pendentes/expirados sem contrato associado, deletá-los antes de deletar o plano
3. Se existirem intents aprovados (com contrato criado), apenas desativar o plano em vez de deletar

Isso mantém a mesma lógica defensiva: se há dados vinculados relevantes, desativa; se não há, limpa os intents órfãos e deleta.

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/hooks/useAdminPartners.ts` | Na função `deletePlan`, adicionar limpeza de `partner_payment_intents` pendentes antes do DELETE, e fallback para desativação se houver intents aprovados |

## Detalhes técnicos

```text
deletePlan(planId):
  1. Checar contracts (já existente)
  2. Se tem contracts → desativar (já existente)
  3. Se não tem contracts:
     a. Deletar payment_intents pendentes/expirados com plan_id = planId
     b. Checar se restam intents aprovados
     c. Se restam → desativar plano
     d. Se não restam → deletar plano permanentemente
```

