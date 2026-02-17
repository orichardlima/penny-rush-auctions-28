

## Reconexao Automatica da Arvore Binaria ao Excluir Usuario

### Problema Atual
Ao excluir um usuario, a edge function simplesmente anula as referencias (`left_child_id`, `right_child_id`, `parent_contract_id`) e deleta o registro. Isso causa:
- Filhos (downline) ficam orfaos, desconectados da arvore
- Pontos propagados pelo usuario deletado permanecem inflados no upline
- A estrutura da arvore binaria se fragmenta

### Solucao
Antes de deletar a posicao binaria do usuario, o sistema ira:
1. Reconectar os filhos ao no pai (avo)
2. Subtrair os pontos do usuario deletado de todo o upline
3. Manter a arvore integra e os pontos consistentes

### Logica de Reconexao

```text
ANTES da exclusao (deletando B):

       A
      / \
     B   ...
    / \
   C   D

DEPOIS da exclusao:

       A
      / \
     C   ...
      \
       D (reposicionado na extremidade direita de C)
```

**Regras:**
- Se B era filho esquerdo de A: o filho esquerdo de B (C) assume a posicao de B como filho esquerdo de A
- Se B era filho direito de A: mesma logica, filho esquerdo de B assume
- O outro filho de B (D) e reposicionado na extremidade da subarvore do primeiro filho (spillover)
- Se B tinha apenas 1 filho, esse filho assume diretamente a posicao de B
- Se B nao tinha filhos, apenas remove e limpa a referencia no pai

### Detalhes Tecnicos

**Arquivo:** `supabase/functions/admin-delete-user/index.ts`

Substituir o bloco atual de tratamento binario (linhas 133-139) por uma logica expandida:

1. **Buscar a posicao binaria do contrato** sendo deletado:
   - `parent_contract_id`, `position`, `left_child_id`, `right_child_id`

2. **Buscar os pontos do plano** do usuario deletado na tabela `partner_level_points`

3. **Subtrair pontos do upline** - Percorrer toda a cadeia de ancestrais:
   - Se o usuario estava na posicao `left` do pai, subtrair de `left_points` e `total_left_points`
   - Se estava na `right`, subtrair de `right_points` e `total_right_points`
   - Continuar subindo ate a raiz

4. **Reconectar filhos:**
   - **Sem filhos**: apenas limpar `left_child_id` ou `right_child_id` no pai
   - **1 filho**: promover esse filho para a posicao de B no pai
     - Atualizar `parent_contract_id` e `position` do filho
     - Atualizar `left_child_id`/`right_child_id` do pai (avo)
   - **2 filhos**: promover o filho esquerdo para a posicao de B, e reposicionar o filho direito na extremidade da subarvore do filho esquerdo (mesma logica de spillover)
     - Atualizar referencias no pai (avo)
     - Atualizar `parent_contract_id` do filho esquerdo
     - Encontrar extremidade direita da subarvore do filho esquerdo
     - Posicionar filho direito la, atualizando `parent_contract_id`, `position`, e `right_child_id` do no extremo

5. **Deletar logs de pontos** (`binary_points_log`) do contrato deletado

6. **Deletar a posicao binaria** do contrato deletado

**Nenhuma alteracao** em outros componentes, hooks, banco de dados, RLS ou UI. Apenas a edge function `admin-delete-user` sera modificada.
