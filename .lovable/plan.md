

## Corrigir handleLink para Propagar Pontos + Recalcular Retroativamente

### Problema
O `handleLink` no `AdminBinaryTreeView.tsx` faz apenas updates manuais nas tabelas (parent, position, child), mas **não chama** a função `propagate_binary_points` que já existe no banco e é responsável por distribuir os pontos para todos os uplines.

### Solução

#### 1. Corrigir `handleLink` para propagar pontos automaticamente

**Arquivo**: `src/components/Admin/AdminBinaryTreeView.tsx`

Após os 2 updates existentes (linhas 180-198), adicionar um passo 3 que:
1. Busca o `plan_name` do contrato do parceiro vinculado em `partner_contracts`
2. Busca os `points` correspondentes em `partner_level_points`
3. Chama `supabase.rpc('propagate_binary_points', ...)` para distribuir os pontos pela árvore acima
4. Exibe no toast quantos pontos foram propagados

Isso garante que **toda futura vinculação** de parceiros isolados também propague pontos corretamente.

#### 2. Adicionar botão "Recalcular Pontos" na tabela de posições

**Arquivo**: `src/components/Admin/AdminBinaryTreeView.tsx`

- Adicionar um botão na tabela geral (PositionsTable) ou no card de resumo que permite ao admin selecionar um parceiro e recalcular/propagar seus pontos retroativamente
- Esse botão chamará `supabase.rpc('propagate_binary_points', { p_source_contract_id, p_points, p_reason: 'manual_recalc' })`
- Útil para corrigir o caso do Adailton e qualquer outro parceiro que tenha sido vinculado sem propagação

### Detalhes Técnicos

**Mudança no `handleLink`** (após linha 198):

```text
// 3. Propagar pontos para uplines
// Buscar plan_name do contrato
// Buscar points de partner_level_points
// Chamar rpc('propagate_binary_points', { source, points, reason: 'admin_link' })
// Incluir no toast a quantidade de pontos propagados
```

**Botão "Recalcular Pontos"** na PositionsTable:
- Adiciona uma coluna "Ações" com um botão por linha
- Ao clicar, abre um Dialog de confirmação mostrando: nome, plano, pontos que seriam propagados
- Confirma e chama o RPC
- Atualiza a tabela após sucesso

### O Que NAO Muda
- A lógica de spillover (BFS) continua igual
- A UI de seleção de sponsor continua igual
- Nenhuma migration de banco necessária (as funções `propagate_binary_points` e `partner_level_points` já existem)
- Nenhum outro componente é alterado
