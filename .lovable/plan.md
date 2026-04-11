

# Corrigir responsividade mobile do painel Admin (UserProfileCard e container)

## Problema

A correção anterior adicionou `overflow-x-hidden` no container principal do AdminDashboard, o que impede o scroll horizontal que o usuário usava para acessar botões de ação cortados. O problema real está em componentes internos que não se adaptam a telas pequenas:

1. **UserProfileCard**: O header coloca o nome do usuário e os botões de ação (histórico, compras, editar, saldo, deletar) lado a lado em `flex justify-between`. Em mobile, os botões saem da tela e ficam inacessíveis.
2. **AdminDashboard container**: O `overflow-x-hidden` esconde conteúdo que deveria ser visível.

## Solução

### 1. `src/components/AdminDashboard.tsx`
- Remover `overflow-x-hidden` do container principal (linha 115) -- manter apenas `min-h-screen`

### 2. `src/components/UserProfileCard.tsx`
- **Header layout** (linha 210): Mudar de `flex items-center space-x-4` para `flex flex-col sm:flex-row items-start sm:items-center gap-4` -- avatar e dados empilham em mobile
- **CardTitle** (linha 217): Mudar de `flex items-center gap-2 justify-between` para `flex flex-wrap items-center gap-2` -- permite que botões de ação quebrem para baixa linha
- **AdminUserActions**: Garantir que os botões de ação fiquem em linha scrollável ou wrap em mobile

### 3. `src/components/AdminUserManagement.tsx`
- Verificar o container dos botões de ação e garantir `flex-wrap` para que caibam em telas pequenas

| Arquivo | Alteração |
|---|---|
| `src/components/AdminDashboard.tsx` | Remover `overflow-x-hidden` |
| `src/components/UserProfileCard.tsx` | Layout responsivo no header: flex-col em mobile, flex-row em desktop; flex-wrap nos botões de ação |

Nenhuma funcionalidade será alterada -- apenas ajustes de CSS responsivo.

