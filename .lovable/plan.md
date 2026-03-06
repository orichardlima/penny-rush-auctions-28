

## Análise: A pontuação de Claudio está incorreta

### O que aconteceu

Claudio tem **2000 pontos à esquerda**, mas deveria ter **1000**. Aqui está o motivo:

Os registros do `binary_points_log` mostram:

```text
1. +1000 esq ← Leonardo Cabral (manual_recalc)  ← CORRETO
2. +1000 esq ← Luis Paulo      (manual_recalc)  ← INCORRETO
3. +0    dir ← Abraão Resende  (qualifier_skip) ← CORRETO
```

- **Luis Paulo** é o 1º indicado direto de Claudio → é um **qualificador** → seus pontos deveriam ter sido pulados
- **Abraão** é o 2º indicado direto → também qualificador → corretamente pulado (0 pontos)
- **Leonardo Cabral** não é indicado direto de Claudio (é indicado de Luis Paulo) → seus pontos propagam normalmente → correto

### Causa raiz (bug)

Na função "Recalcular Pontos" do admin (`AdminBinaryTreeView.tsx`, linha 244), o `p_sponsor_contract_id` é passado como **`null`**. Isso faz com que a lógica de skip de qualificadores **nunca seja avaliada** durante recálculos manuais, permitindo que pontos de qualificadores sejam adicionados indevidamente.

### Correção

1. **Corrigir `handleRecalculate`** em `AdminBinaryTreeView.tsx`: ao recalcular pontos de um parceiro, buscar o `sponsor_contract_id` dele na tabela `partner_binary_positions` e passá-lo para a RPC `propagate_binary_points`, garantindo que a lógica de qualificadores seja respeitada
2. **Corrigir os pontos de Claudio**: ajustar manualmente os `left_points` de Claudio de 2000 para 1000 (remover os 1000 indevidos do Luis Paulo)

### Arquivos impactados
- **`src/components/Admin/AdminBinaryTreeView.tsx`**: buscar `sponsor_contract_id` do nó alvo e passar na chamada RPC

