

## Melhorar Responsividade do Gerenciamento de Parceiros

### Problemas Identificados (baseado na screenshot)

1. **Cards de estatisticas**: Os 5 cards em uma unica linha (`md:grid-cols-5`) causam truncamento de valores monetarios em tablets (ex: "R$ 64.483," cortado)
2. **Tabela de dias (Faturamento Diario)**: A tabela com 4 colunas (Dia, Porcentagem, Exemplos por Plano, Status) nao cabe bem em telas menores - a coluna "Exemplos por Plano" ocupa espaco excessivo
3. **Grid semanal do Progresso Mensal**: `grid-cols-4` fixo pode ficar apertado em mobile
4. **Distribuicao Rapida**: Layout dos inputs pode ficar apertado

### Alteracoes Planejadas

**1. Cards de Estatisticas** (`AdminPartnerManagement.tsx`)
- Mudar de `grid-cols-1 md:grid-cols-5` para `grid-cols-2 md:grid-cols-3 lg:grid-cols-5`
- Em mobile: 2 colunas; em tablet: 3 colunas; em desktop: 5 colunas

**2. Tabela de Dias** (`DailyRevenueConfigManager.tsx`)
- Esconder a coluna "Exemplos por Plano" em telas pequenas com `hidden md:table-cell`
- Esconder a coluna "Status" em telas muito pequenas com `hidden sm:table-cell`
- Adicionar `overflow-x-auto` ao container da tabela

**3. Grid Semanal do Progresso Mensal** (`DailyRevenueConfigManager.tsx`)
- Mudar de `grid-cols-4` para `grid-cols-2 sm:grid-cols-4`

**4. Resumo Mensal** (`DailyRevenueConfigManager.tsx`)
- Ajustar tamanho dos textos em mobile (de `text-2xl` para `text-xl sm:text-2xl`)

### Detalhes Tecnicos

Arquivo 1: `src/components/Admin/AdminPartnerManagement.tsx`
- Linha ~387: Ajustar grid dos stats cards

Arquivo 2: `src/components/Admin/DailyRevenueConfigManager.tsx`
- Linha ~320: Ajustar grid do resumo mensal
- Linha ~361: Ajustar grid semanal
- Linhas ~414-466: Adicionar classes responsivas na tabela de dias (hidden columns)
- Container da tabela com overflow-x-auto

Nenhuma funcionalidade, logica de calculo ou workflow sera alterado. Apenas classes CSS do Tailwind serao ajustadas.
