## Objetivo

Adicionar uma visão admin que mostre, por semana, quais parceiros confirmaram (ou não) a divulgação diária do AdCenter — com filtros, status de meta e histórico individual.

## Onde

Nova aba **"Divulgação Semanal"** dentro de `AdminPartnerManagement.tsx` (rota `/admin/parceiros`), ao lado das abas já existentes.

## Componentes a criar

1. `src/components/Admin/AdminWeeklyAdsTab.tsx` — UI da aba (cards, filtros, tabela, modal de histórico).
2. `src/hooks/useAdminWeeklyAds.ts` — busca de dados, agregações por parceiro/semana.

Integração: importar `AdminWeeklyAdsTab` em `AdminPartnerManagement.tsx` e registrar um `<TabsTrigger>` + `<TabsContent>` novos. Nenhuma outra tela, hook ou regra existente é alterada.

## UI

**Cabeçalho (cards-resumo da semana selecionada):**
- Total de parceiros ativos
- Confirmaram ≥1 dia
- Cumpriram a meta (7/7) → habilita 100% no payout da semana
- Abaixo da meta (1–6/7) → 40%
- Zerados (0/7)

**Filtros:**
- Semana: "Atual", "Anterior", ou seletor de data (usa a mesma lógica Seg–Dom de `useAdCenter`).
- Escopo: "Todos ativos" / "Apenas com ≥1 confirmação" (atende a resposta "Ambos, com filtro").
- Status: Todos / Meta cumprida / Abaixo / Zerados.
- Busca por nome, e-mail ou WhatsApp.
- Ordenar por: dias confirmados, nome, plano.

**Tabela (uma linha por contrato ativo):**

| Parceiro | Plano | S | T | Q | Q | S | S | D | Total | Status |
|---|---|---|---|---|---|---|---|---|---|---|

- Células dos dias: ✓ verde se há `ad_center_completions` no dia, "—" cinza se passou sem confirmação, vazio claro se futuro, anel azul no dia de hoje.
- Status: badge verde "Meta 100%", âmbar "Penalidade 40%", cinza "Zerado", azul "Em andamento" (só na semana atual).
- Ação: botão "Histórico" abre modal com últimas 4 semanas do parceiro em formato 7 dias + total.

**Exportar CSV** da visão filtrada (nome, e-mail, plano, dias 1–7, total, status).

## Dados

Tudo via Supabase com a sessão admin (RLS já permite admin ler ambas as tabelas):

- `partner_contracts` `status='ACTIVE'` → join com `profiles` (nome, e-mail, whatsapp) e `partner_plans` (nome do plano).
- `ad_center_completions` filtrado por `completion_date BETWEEN weekStart AND weekEnd` e `partner_contract_id IN (...)`.
- Agregação no cliente: para cada contrato, montar array de 7 dias e marcar `completed` se existir registro na data.
- Cálculo do status reaproveita as constantes de `useAdCenter` (REQUIRED_DAYS=7, FULL=100%, PENALTY=40%).
- Modal de histórico: mesma query estendida para 4 semanas (28 dias).

## Detalhes técnicos

- Sem migrações; sem novas policies. Apenas leitura.
- Helpers de semana (`getWeekStart`, `getWeekEnd`, `formatDateBrazil`) extraídos/reaproveitados de `useAdCenter.ts` em um util compartilhado `src/utils/weekHelpers.ts` para não duplicar (única refatoração; `useAdCenter` passa a importar de lá, comportamento idêntico).
- Paginação cliente-side (50 por página) — suficiente para o volume atual de parceiros ativos.
- Loading skeleton enquanto carrega; estado vazio amigável.
- Mobile: tabela com scroll horizontal; cards-resumo em grid responsivo (segue padrão das outras abas).

## Fora de escopo

- Não mexer no `AdCenterDashboard` do parceiro nem em `useAdCenter` (além da extração de helpers, sem mudança de comportamento).
- Não alterar regras de payout (40% / 100%) — apenas exibir o status resultante.
- Não criar ações de "marcar manualmente" — só visualização.
