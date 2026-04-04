

# Corrigir o bug persistente do piscar no rendimento semanal do modal

## Causa real

O problema não está mais no polling em si. O bug continua porque o `PartnerDetailModal` recria o objeto `weekContract` a cada render:

- `PartnerDetailModal.tsx` monta `const weekContract = contract ? { ... } : null`
- esse objeto novo entra no `useCurrentWeekRevenue(weekContract)`
- no hook, o `useEffect` depende de `contract`
- como a referência muda em toda renderização, o efeito roda de novo
- isso executa `isFirstLoad.current = true`, reativa `loading` e faz a área sumir/aparecer

Ou seja: mesmo sem trocar de parceiro, o hook entende como “novo contrato” o tempo todo.

## Ajuste proposto

### 1. `src/components/Admin/PartnerDetailModal.tsx`
Memoizar o objeto enviado ao hook:

- importar `useMemo`
- trocar a criação direta de `weekContract` por um `useMemo`
- dependências: `contract?.id`, `contract?.aporte_value`, `contract?.weekly_cap`, `contract?.user_id`, `contract?.created_at`

Resultado:
- o objeto só muda quando o parceiro realmente mudar
- o hook para de reinicializar a cada render do modal

### 2. `src/hooks/useCurrentWeekRevenue.ts`
Deixar o hook mais estável para evitar regressões:

- remover o reset amplo `isFirstLoad.current = true` em toda execução do efeito
- resetar apenas quando a identidade do contrato mudar de verdade
- preferir dependências estáveis no `useEffect`, como:
  - `contract?.id`
  - `contract?.created_at`
  - `contract?.aporte_value`
  - `contract?.weekly_cap`
  - `weekBounds`
- manter o comportamento atual de:
  - loading só na carga inicial
  - polling silencioso
  - não derrubar a UI se houver falha temporária de fetch

## Resultado esperado

Após isso:

- o card “Rendimento da Semana Atual” deixa de desaparecer
- as barras não resetam a cada refresh do modal
- o spinner só aparece na primeira carga ou quando abrir outro parceiro
- falhas temporárias de rede não limpam a visualização já exibida

## Arquivos a alterar

- `src/components/Admin/PartnerDetailModal.tsx`
- `src/hooks/useCurrentWeekRevenue.ts`

## Observação técnica

O `PartnerDashboard.tsx` já passa o contrato diretamente ao hook, então esse comportamento tende a afetar mais o modal admin, porque ali o objeto foi reconstruído manualmente antes de ser enviado ao hook.

