# Plano: Sub-aba "Divulgação Semanal" dentro de Anúncios

## Objetivo
Permitir que o ADM veja quais parceiros cumpriram (ou não) a tarefa diária da Central de Anúncios na semana, sem alterar nenhum fluxo existente.

## Onde
Dentro da aba **Anúncios** em `Gestão de Parceiros`, transformar o conteúdo atual em duas sub-abas:
- **Materiais** → componente atual `AdCenterMaterialsManager`
- **Divulgação Semanal** → nova visão de cumprimento

Nada fora da aba Anúncios é tocado.

## Arquivos a criar
1. `src/utils/weekHelpers.ts` — helpers compartilhados (semana segunda→domingo, formatação BR), espelhando a regra já usada em `useAdCenter`.
2. `src/hooks/useAdminWeeklyAds.ts` — busca `partner_contracts` (status=ACTIVE) + `ad_center_completions` da semana selecionada + `profiles`, agrega por parceiro e calcula status: META (7/7), PENALIDADE (1–6/7), ZERADO (0/7), EM ANDAMENTO (semana atual ainda em curso).
3. `src/components/Admin/AdminWeeklyAdsTab.tsx` — UI da sub-aba:
   - Cards-resumo: total de parceiros ativos, ≥1 confirmação, META, PENALIDADE, ZERADO
   - Tabela com colunas S T Q Q S S D (✓/—), badge de status, ações
   - Controles: navegação Atual/Anterior, filtros (escopo, status, busca), modal "Histórico" (últimas 4 semanas) e exportar CSV
   - Sem mutações: 100% leitura

## Arquivos a editar
- `src/components/Admin/AdminPartnerManagement.tsx`
  - Substituir o conteúdo de `<TabsContent value="adcenter">` por um `<Tabs>` interno com duas sub-abas (`materials` | `weekly`).
  - Sem alterar nenhuma outra aba, hook ou lógica.
- `src/hooks/useAdCenter.ts` *(opcional, somente se reaproveitar helpers)*: refatorar para importar de `weekHelpers.ts` mantendo 100% do comportamento atual.

## Regras de negócio (espelham o Dashboard do Parceiro)
- Semana = segunda 00:00 → domingo 23:59 (horário Brasil)
- Meta: 7/7 confirmações → payout 100%
- 1–6/7 → penalidade (40%)
- 0/7 → zerado
- Fonte: `ad_center_completions.partner_contract_id` + `partner_contracts.status='ACTIVE'`

## Fora de escopo
- Nenhuma mudança em UI/fluxo do parceiro, payouts, materiais, ou demais abas.
- Sem notificações automáticas nem marcação manual (podem ser propostas depois).
