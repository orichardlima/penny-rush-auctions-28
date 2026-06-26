## Problema

Atualmente o painel "Central de Anúncios" do parceiro mostra **apenas a semana corrente** (Seg–Dom). Não há como o parceiro visualizar semanas anteriores, conferir quais dias confirmou ou esqueceu, ou em qual rede divulgou.

## Solução

Adicionar um **Histórico Retroativo de Semanas** no `AdCenterDashboard`, sem alterar o fluxo atual de confirmação diária.

### 1. Hook `useAdCenter` (`src/hooks/useAdCenter.ts`)

- Nova função `fetchHistory(weeksBack = 8)` que busca todas as `ad_center_completions` do contrato nas últimas N semanas (default 8).
- Novo memo `weeklyHistory` que agrupa as completions por semana (Seg–Dom), retornando para cada semana:
  - `weekStart`, `weekEnd` (datas)
  - `days[]`: 7 itens com `date`, `dayName`, `dayNumber`, `completed`, `socialNetwork`, `confirmedAt`
  - `completedDays`, `requiredDays = 7`
  - `unlockPercentage` (100% se 7/7, senão 40%)
  - `status`: `META` (7/7), `PARCIAL` (1–6) ou `ZERO` (0)
- Exportar `weeklyHistory` e `loadingHistory` do hook.

### 2. Novo componente `WeeklyAdsHistory` (`src/components/Partner/WeeklyAdsHistory.tsx`)

Lista expansível (Accordion) com uma entrada por semana passada:

- Cabeçalho: período "DD/MM – DD/MM", badge de status (META 100% / PARCIAL 40% / ZERO 40%) e contagem "X/7 dias".
- Conteúdo expandido: grid de 7 dias (mesmo visual do histórico atual) mostrando ✓ confirmado, ✗ esquecido, ícone da rede social usada e horário do `confirmed_at`.
- Filtro simples no topo: seletor "Últimas 4 / 8 / 12 semanas" (default 8).
- Responsivo (grid colapsa em mobile).

### 3. Integração no `AdCenterDashboard.tsx`

- Abaixo do card "Histórico da Semana" (atual semana), adicionar uma nova seção colapsada por padrão:
  - Card com título "Semanas Anteriores" + descrição curta.
  - Renderiza `<WeeklyAdsHistory completions={...} weeksBack={n} />`.
- Manter intacto: progresso semanal, material do dia, fluxo de confirmação, alertas e card da semana atual.

### Detalhes técnicos

- A tabela `ad_center_completions` já contém `completion_date`, `social_network`, `confirmed_at`, `partner_contract_id` — nenhuma migração necessária.
- A política RLS atual já permite o parceiro ler suas próprias confirmações.
- Reaproveitar helpers existentes `getWeekStart` / `getWeekEnd` / `formatDateBrazil`.
- Ícones reaproveitados de `SOCIAL_NETWORKS` para identificar a rede usada em cada dia.

### Fora de escopo

- Nenhuma alteração em fluxos de pagamento, payouts, materiais ou regras de bônus.
- Nenhuma alteração no painel administrativo (admin já tem `useAdminWeeklyAds` + `fetchContractHistory`).