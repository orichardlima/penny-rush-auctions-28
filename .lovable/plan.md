## Objetivo
Adicionar um filtro/toggle "Mostrar inativos" na aba **Planos de Participação** do painel admin, para que planos com `is_active = false` fiquem ocultos por padrão e a tabela fique limpa.

## Alterações

### 1. Estado e Toggle
- Adicionar estado local `showInactivePlans` (boolean, default `false`) no componente `AdminPartnerManagement`.
- Inserir um `<Switch>` com label "Mostrar inativos" ao lado do botão "Novo Plano" no header do card da aba `plans`.

### 2. Filtragem da Tabela
- Aplicar filtro na renderização da tabela de planos (`plans.map`):
  - Se `showInactivePlans === false`, exibir apenas `plan.is_active === true`.
  - Se `showInactivePlans === true`, exibir todos os planos.
- Exibir um contador sutil (ex: "X planos exibidos") ou manter a mensagem de "Nenhum plano encontrado" caso o filtro zere a lista.

## Arquivo Alvo
- `src/components/Admin/AdminPartnerManagement.tsx`

## Fora do Escopo
- Nenhuma mudança em hooks, backend, ou regras de soft delete de planos.
- Nenhuma alteração em outras abas do admin.