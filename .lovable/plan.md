

## Plano: Responsividade total da árvore binária

### Problema
Os nós nas extremidades da árvore ficam cortados no mobile porque o container de scroll não tem padding suficiente e os nós têm tamanho fixo grande demais.

### Alterações em `src/components/Partner/BinaryNetworkTree.tsx`

1. **Nós menores no mobile**: `w-28 sm:w-32` (preenchidos) e `w-20 sm:w-24` (vazios)
2. **Gap reduzido entre filhos**: `gap-2 sm:gap-4`
3. **Conectores menores**: linhas horizontais `w-10 sm:w-16`
4. **Padding no container de scroll**: adicionar `px-6` ao wrapper interno da árvore para evitar corte nas bordas
5. **Min-width ajustado**: trocar `min-w-[400px]` por `min-w-fit` para que o scroll se adapte ao conteúdo real
6. **Texto responsivo**: fontes ligeiramente menores em mobile nos nós

Apenas o componente `BinaryNetworkTree.tsx` será alterado. Nenhuma funcionalidade ou outro componente será modificado.

