

## Plano: Corrigir `undefined` → `null` nas chamadas RPC

### Problema

O `undefined` é removido pelo cliente Supabase JS ao serializar para JSON, fazendo com que apenas 3 parâmetros sejam enviados ao Postgres — o que causa novamente o erro de ambiguidade entre as duas sobrecargas de `propagate_binary_points`.

### Solução

Trocar `p_sponsor_contract_id: undefined` por `p_sponsor_contract_id: null` nas duas chamadas em `AdminBinaryTreeView.tsx` (linhas 244 e 306). O `null` é preservado na serialização JSON e resolve a ambiguidade.

