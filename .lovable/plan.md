## Objetivo
Exibir a coluna **Pontos Binários** na tabela de Planos de Participação, junto com as demais informações já mostradas (Aporte, Limites, Bônus, Lances etc.).

## Alterações

### 1. Carregar pontos binários para todos os planos
- No `AdminPartnerManagement.tsx`, adicionar estado `planBinaryPoints` (`Record<string, number>` indexado por `plan.name`).
- Adicionar um `useEffect` que, sempre que `plans` mudar, busca todos os registros de `partner_level_points` (uma única query: `select plan_name, points`) e popula o map.

### 2. Nova coluna na tabela
- Inserir `<TableHead>Pontos Bin.</TableHead>` entre "Lances Bônus" e "Status".
- Em cada linha, exibir `planBinaryPoints[plan.name] ?? 0` com estilo destacado (ex: `text-purple-600 font-medium`), consistente com as outras colunas numéricas.

## Arquivo Alvo
- `src/components/Admin/AdminPartnerManagement.tsx`

## Fora do Escopo
- Edição inline (a edição continua via dialog existente, que já carrega/salva `binary_points`).
- Mudanças em hooks ou backend.