
## Adicionar Campo de Pesquisa por Nome na Rede Binaria

### Objetivo
Adicionar um campo de busca acima da arvore binaria para que o usuario possa pesquisar pelo nome de um downline. Ao encontrar, o nó correspondente sera destacado visualmente.

### Implementacao

**Arquivo: `src/components/Partner/BinaryNetworkTree.tsx`**

1. Adicionar um estado `searchQuery` e importar o componente `Input` e o icone `Search`
2. Inserir o campo de busca entre o seletor de profundidade e a visualizacao da arvore
3. Criar logica para verificar se um nó (ou seus descendentes) corresponde a busca
4. Destacar visualmente os nós cujo nome corresponde ao termo buscado (borda amarela/dourada e leve glow)
5. Auto-expandir nós que contenham descendentes correspondentes a busca

### Detalhes Tecnicos

- O campo de busca tera o placeholder "Buscar downline por nome..."
- A busca sera case-insensitive e filtrara pelo campo `partner_name` dos nós da arvore (`BinaryTreeNode[]`)
- Nós correspondentes receberao uma classe CSS de destaque (ex: `ring-2 ring-yellow-400`)
- Se houver texto de busca, nós ancestrais de resultados serao automaticamente expandidos
- O componente `TreeNode` recebera duas novas props: `searchQuery` e `matchingNodeIds` (Set de contract_ids que correspondem a busca)
- Botao de limpar (X) aparecera dentro do input quando houver texto
- Nenhuma alteracao no hook `useBinaryNetwork` ou em outros componentes
