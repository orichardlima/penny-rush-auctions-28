

## Vincular manualmente parceiros isolados a arvore binaria

### Objetivo

Adicionar um botao "Vincular" em cada linha de parceiro isolado na tabela de isolados do `AdminBinaryTreeView`, que abre um dialog permitindo ao admin escolher o no pai e a posicao (esquerda/direita).

### Mudancas

**Arquivo**: `src/components/Admin/AdminBinaryTreeView.tsx`

1. Adicionar um dialog (AlertDialog ou Dialog) de vinculacao com:
   - Select para escolher o no pai (lista de todos os parceiros conectados que tenham vaga livre na posicao escolhida)
   - Radio group para escolher posicao: Esquerda ou Direita
   - Validacao: so mostrar posicoes disponiveis (se o pai ja tem filho esquerdo, so mostrar "Direita" e vice-versa)
   - Botao de confirmacao

2. Na tabela de parceiros isolados, adicionar coluna "Acoes" com botao "Vincular" que abre o dialog pre-selecionando o parceiro isolado

3. Logica de vinculacao (ao confirmar):
   - UPDATE no registro do parceiro isolado: setar `parent_contract_id`, `sponsor_contract_id` (igual ao pai) e `position` (left/right)
   - UPDATE no registro do pai: setar `left_child_id` ou `right_child_id` com o `partner_contract_id` do isolado
   - Ambos os updates via `supabase` client direto (padrao admin ja usado)
   - Apos sucesso, chamar `fetchData()` para atualizar a visualizacao
   - Toast de sucesso/erro

4. Filtro inteligente de nos pai: ao selecionar uma posicao, filtrar apenas pais que tenham aquela posicao livre. Ao selecionar um pai, filtrar apenas posicoes disponiveis.

### Detalhes tecnicos

As duas queries de update necessarias:

```text
-- 1. Atualizar o registro do parceiro isolado
UPDATE partner_binary_positions
SET parent_contract_id = <pai_contract_id>,
    sponsor_contract_id = <pai_contract_id>,
    position = 'left' | 'right'
WHERE partner_contract_id = <isolado_contract_id>

-- 2. Atualizar o registro do pai
UPDATE partner_binary_positions
SET left_child_id = <isolado_contract_id>  -- ou right_child_id
WHERE partner_contract_id = <pai_contract_id>
```

Nao e necessaria migration SQL pois as colunas ja existem. O admin ja tem permissao ALL na tabela via RLS policy `Admins can manage all binary positions`.

### O que NAO muda

- Nenhuma outra pagina ou componente e alterado
- A arvore hierarquica, resumo, tabela completa e todas as outras abas permanecem intactas
- Nenhuma migration necessaria

