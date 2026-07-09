
## Objetivo

Expor ao parceiro, dentro da aba **Central de Anúncios**, uma nova seção **"Minha Performance"** que mostra os dados coletados pela Central de Performance (cliques rastreados, cadastros, conversões, pontuação semanal e posição no ranking) — **sem afetar o repasse**, sem substituir o fluxo atual de confirmação manual e mantendo a proteção "modo relatório".

## Onde entra visualmente

Dentro de `src/components/Partner/AdCenterDashboard.tsx`, **abaixo** do Card "Progresso Semanal" e **antes** de "Material de Hoje". Nada do fluxo existente (alertas, confirmação manual 7 dias, histórico) é removido ou alterado.

```text
[Alerta inadimplência]
[Alerta Central de Anúncios (7 dias)]
[Card Progresso Semanal]        ← já existe
[NOVA SEÇÃO: Minha Performance] ← novidade, colapsável
[Card Material de Hoje]         ← já existe
[Card Histórico da Semana]      ← já existe
[Histórico Retroativo]          ← já existe
```

## Regras de visibilidade

A nova seção só aparece quando:

- `performance_tracking_enabled = true` **E**
- `performance_center_partner_visible = true` (nova flag, default `false` — funciona como "botão liga/desliga" para o parceiro, independente da flag `performance_center_enabled` que continua controlando conexão com payout)

Enquanto `performance_center_partner_visible = false`, o parceiro não vê nada de novo. Isso permite ativar a exibição gradualmente (ex.: só para você primeiro) sem tocar em outras flags.

Dentro da seção, mostrar sempre um **badge "Modo relatório — não impacta seu repasse"** para reforçar transparência.

## Conteúdo da seção "Minha Performance"

1. **Meu link rastreável** — `showdelances.com/r/{código}` com botão "Copiar". Buscar código em `referral_links` (ou fallback para `affiliates.affiliate_code` / `partner_contracts.referral_code`).
2. **KPIs da semana atual** (4 cards compactos): Cliques qualificados, Cadastros, Compras aprovadas, Novos parceiros. Fonte: `tracking_events` + `attribution_events` filtrados por `partner_user_id = auth.uid()` e `week_start`.
3. **Meus pontos da semana** — total, cliques vs. conversões, dias ativos. Fonte: `partner_weekly_scores`.
4. **Minha posição no ranking** — "Você está em Xº de N parceiros". Calculada a partir de `partner_weekly_scores` da semana.
5. **Mini-histórico últimas 4 semanas** — barrinhas com total de pontos por semana.
6. **Aviso didático** — "Estes dados são informativos. O repasse continua sendo calculado pelas confirmações diárias acima." + link para `/guia-parceiro`.

## Passos de implementação

### 1. Migration
- Inserir em `performance_settings` a nova chave `performance_center_partner_visible` com `setting_value = 'false'`.
- Criar RPC `get_partner_performance_summary(_week_start date)` (SECURITY DEFINER) que retorna, para `auth.uid()`:
  - `referral_code`, `qualified_clicks`, `signups`, `purchases_approved`, `contracts_approved`, `total_points`, `click_points`, `conversion_points`, `active_days`, `week_rank`, `week_total_partners`.
- Criar RPC `get_partner_performance_history(_weeks int)` que retorna as últimas N semanas: `week_start`, `total_points`.
- GRANT EXECUTE nas duas RPCs para `authenticated`.

Nenhuma alteração em `partner_weekly_eligibility`, `partner_payouts`, triggers financeiros ou lógica de repasse.

### 2. Frontend

- Criar hook `src/hooks/usePartnerPerformance.ts` que:
  - Lê `performance_tracking_enabled` e `performance_center_partner_visible` em `performance_settings`.
  - Chama as duas RPCs acima quando ambas as flags estiverem `true`.
  - Retorna `{ visible, summary, history, loading }`.
- Criar componente `src/components/Partner/PartnerPerformanceSection.tsx` (colapsável, `<Accordion>` ou `<Collapsible>` já disponível no shadcn) com os 6 blocos acima.
- Editar `src/components/Partner/AdCenterDashboard.tsx` para renderizar `<PartnerPerformanceSection contractId={partnerContractId} />` na posição indicada. Nenhuma outra linha do arquivo muda.

### 3. Validação
- Com `performance_center_partner_visible = false` → seção invisível para todos.
- Ativar a flag apenas para teste → seção aparece com dados reais do usuário logado.
- Confirmar que RPCs só retornam dados do próprio `auth.uid()` (nada de outros parceiros).
- Confirmar que nenhum cálculo de `partner_payouts` ou `partner_weekly_eligibility` foi alterado.

## O que NÃO será alterado

- Fluxo de confirmação manual de 7 dias (botão "Confirmar Divulgação").
- Regra atual de repasse 100% vs 40%.
- `performance_center_enabled` continua `false` (payout desconectado).
- Rota `/admin/central-performance` e RPCs administrativas.
- `PartnerDashboard`, roteamento, header, guia do parceiro.

## Resultado esperado

Quando você ativar `performance_center_partner_visible = true`, cada parceiro passa a ver, dentro da própria Central de Anúncios, os números reais da sua divulgação rastreada — mantendo total transparência de que ainda é modo relatório e o repasse continua pelo mecanismo atual.
