
## Auditoria de Compliance – Termos a Corrigir

Varredura completa do site identificou ocorrências de **"investimento"**, **"rendimento"**, **"ROI"**, **"retorno"** e **"investidor"** em áreas voltadas ao público (landing do parceiro, dashboard pessoal, SEO, hero da home). Esses termos podem caracterizar oferta de investimento financeiro perante CVM/BCB e devem ser substituídos pela linguagem oficial de **parceria/aporte/repasse**.

### Substituições padrão a aplicar

| Termo atual | Substituir por |
|---|---|
| Investimento / Investir | Aporte / Participar como parceiro |
| Investidor | Parceiro |
| Rendimento / Rendimentos | Repasse / Repasses |
| Retorno / Retorno sobre investimento | Recebimento / Resultado da parceria |
| Simular Investimento | Simular Participação |
| Calculadora de Investimento | Simulador de Parceria |
| "/investir" (texto visível) | "/parceiro" |

### Arquivos com alterações apenas de copy/UI visível

1. **`src/components/Investir/InvestmentHero.tsx`**
   - Manter o badge legal "não representa investimento financeiro" (é disclaimer correto).
   - Sem outras ocorrências visíveis — manter.

2. **`src/components/Investir/InvestmentFAQ.tsx`**
   - Reformular a primeira pergunta: trocar `"Isso é um investimento financeiro?"` por `"O Programa de Parceiros é um investimento financeiro?"` mantendo a resposta atual (já está em conformidade).

3. **`src/pages/PartnerLanding.tsx`**
   - Meta description: trocar `"rendimentos semanais"` por `"repasses semanais"`.

4. **`src/pages/MinhaParceria.tsx`**
   - Meta description: trocar `"Acompanhe seu investimento, rendimentos semanais…"` por `"Acompanhe seus aportes, repasses semanais e gerencie sua parceria…"`.

5. **`src/pages/AdminParceiros.tsx`** (visível apenas para admin no `<title>`)
   - Trocar `"contratos de investimento"` por `"contratos de parceria"`.

6. **`src/components/Partner/PartnerDashboard.tsx`** (linhas 899 e 1123)
   - Trocar `"rendimento semanal da plataforma"` por `"faturamento semanal da plataforma"`.

7. **`src/components/UserProfileCard.tsx`** (linha 467)
   - Trocar `"Acompanhar rendimentos e indicações."` por `"Acompanhar repasses e indicações."`.

8. **`src/components/HeroSection.tsx`** (linha 81)
   - Atualizar link de `"/investir"` para `"/parceiro"` (a rota antiga já redireciona, mas evita o termo no HTML/SEO).

### Áreas **mantidas como estão** (decisão consciente)

- **`AuctionHistory.tsx`, `PersonalAnalytics.tsx`, `FinancialDashboard.tsx`, `AuctionDetailView.tsx`, `FinancialAnalytics/AuctionFinancialCard.tsx`, `AdminFinancial/TopPerformingAuctions.tsx`** — usam ROI/retorno no contexto de **leilões** (gasto em lances vs valor do produto arrematado). Isso é métrica de jogo/leilão, não de programa de parceria, e não configura oferta de investimento. **Não alterar.**
- **Pasta `src/components/Investir/`** e rota `/investir` em `App.tsx` (já é redirect → `/parceiro`) — renomear pasta/rota é refactor amplo e fora do escopo de compliance de copy. Mantém-se como nomenclatura interna de código.
- **Disclaimers existentes** (`PartnershipDisclaimer.tsx`, hero, FAQ, rodapé legal de `PartnerLanding`) usam "investimento financeiro" no sentido negativo ("não é investimento financeiro") — **manter**, é o texto exigido pela própria proteção jurídica.

### Escopo

Mudança puramente de copy/texto visível e meta tags. Sem alteração de lógica, rotas funcionais, schema ou componentes. Não toca em ROI dos leilões (contexto diferente).

### Itens fora do escopo desta entrega (sugestão futura)

- Renomear pasta `src/components/Investir/` → `src/components/Parceria/` e atualizar imports.
- Remover a rota legada `/investir` do `App.tsx` quando não houver mais referências externas.
