

## Adicionar Campo de Pesquisa por Nome nas Tabelas de Parceiros

### Problema
As tabelas "Parceiros Isolados" e "Todos os Registros" no painel admin da arvore binaria nao possuem campo de busca, dificultando encontrar parceiros especificos quando a lista e grande.

### Solucao

**Arquivo: `src/components/Admin/AdminBinaryTreeView.tsx`**

Adicionar um campo de pesquisa (Input) em cada uma das duas sub-tabelas (`IsolatedTable` e `PositionsTable`) que filtra os registros pelo nome do parceiro em tempo real.

### Detalhes Tecnicos

1. **`IsolatedTable` (linha ~471)**: Adicionar estado local `searchTerm` e um `Input` com icone de busca acima da tabela. Filtrar `positions` por `partnerName` antes de renderizar as linhas.

2. **`PositionsTable` (linha ~509)**: Mesma abordagem - estado local `searchTerm`, campo `Input` com placeholder "Buscar parceiro..." e filtro por `partnerName`.

3. **Import necessario**: `Search` do lucide-react (ja importado no projeto em outros componentes) e `Input` (ja importado no arquivo).

4. Nao precisa importar nada novo - `Input` ja esta no escopo do arquivo, apenas nao e usado. Adicionar `Search` ao import do lucide-react na linha 13.

### O Que NAO Muda
- Nenhuma logica de vinculacao, recalculo ou propagacao de pontos
- Arvore hierarquica e cards de resumo permanecem iguais
- Nenhum outro componente ou pagina e alterado

