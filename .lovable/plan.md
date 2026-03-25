

# Excluir Ailton Nobre dos Vencedores Recentes

## Diagnóstico

O código atual tenta filtrar bots via `is_bot`, mas o Ailton Nobre provavelmente não tem `is_bot = true` no perfil, então passa pelo filtro. A deduplicação por `winner_id` deveria manter só 1 ocorrência, mas como ele aparece 3 vezes, o código atual pode não estar refletindo as mudanças anteriores corretamente.

## Solução

Adicionar um filtro explícito por nome `winner_name` para excluir "Ailton Nobre" da lista, além de reforçar a deduplicação existente. Também aumentar o `limit` para 24 para compensar os registros removidos.

## Mudança em `src/hooks/useRecentWinners.ts`

- Na query, adicionar `.not('winner_name', 'ilike', '%Ailton Nobre%')` para excluir diretamente do banco
- Aumentar `limit` de 12 para 24
- Manter a deduplicação por `winner_id` já existente

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRecentWinners.ts` | Filtrar Ailton Nobre na query + aumentar limit para 24 |

