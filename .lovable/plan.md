

## Plano: Corrigir erro de ambiguidade na RPC `propagate_binary_points`

### Problema

O Postgres não consegue escolher entre duas sobrecargas da função `propagate_binary_points` quando chamada com 3 argumentos (`p_source_contract_id`, `p_points`, `p_reason`), pois ambas as assinaturas aceitam esses parâmetros.

### Solução

No arquivo `src/components/Admin/AdminBinaryTreeView.tsx`, nas duas chamadas a `propagate_binary_points`, adicionar explicitamente o parâmetro `p_sponsor_contract_id: null` para forçar a escolha da sobrecarga de 4 parâmetros e eliminar a ambiguidade.

**Chamada 1 (~linha 240)**: `handleRecalculate` — adicionar `p_sponsor_contract_id: undefined`
**Chamada 2 (~linha 301)**: `handleLink` — adicionar `p_sponsor_contract_id: undefined`

Nenhuma alteração de banco de dados necessária.

