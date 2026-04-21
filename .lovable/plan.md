

## Adicionar filtros à aba "Templates de Produtos"

A aba já tem só um filtro de categoria. Vou adicionar os filtros que faltam para encontrar templates rapidamente.

### Mudança (1 arquivo)

**Arquivo:** `src/components/Admin/ProductTemplatesManager.tsx`

No `<CardHeader>` da "Biblioteca de Templates", substituir o filtro único por uma barra de filtros com:

1. **Campo de busca por texto** (ícone de lupa) — busca no `title` e `description` do template, case-insensitive.
2. **Filtro de categoria** (já existe, mantido).
3. **Filtro de tier** — opções: Todos, Standard, Premium, Luxury.
4. **Filtro de status** — opções: Todos, Ativos, Inativos.
5. **Botão "Limpar filtros"** — aparece quando algum filtro está ativo.

### Comportamento

- Os 4 filtros aplicam-se em conjunto (AND) sobre `templates`.
- O contador `Biblioteca de Templates (N)` reflete o total filtrado.
- Layout responsivo: linha única em desktop (≥sm), empilhado em mobile com `flex-wrap`.
- Estado local via `useState` (search, tier, status), seguindo o padrão do `categoryFilter` atual.
- Mensagem "Nenhum template encontrado" continua funcionando.

### O que NÃO muda

- Estrutura da tabela, colunas, ações, badges e imagens permanecem idênticos.
- Diálogos de criação/edição, geração de imagens IA, geração de leilões em lote — todos intactos.
- Hook `useProductTemplates` permanece sem alteração (filtragem 100% client-side).
- Nenhuma outra aba ou funcionalidade é tocada.

