# Reescrita de Linguagem: Remover Terminologia de MMN

## Objetivo

Substituir vocabulário típico de Marketing Multinível por linguagem de "programa de parceria corporativa" em **toda a interface visível** (landing, dashboard do parceiro e painel admin), reforçando disclaimers onde houver menção a bônus/rede. Lógica de negócio, nomes de tabelas, colunas, funções RPC e endpoints **não mudam** — apenas textos visíveis (strings JSX, labels, títulos, descrições, toasts, tooltips, e-mails).

## Glossário aprovado (aplicado de forma global)

| De (MMN) | Para |
|---|---|
| Patrocinador / Sponsor | Parceiro indicador / Quem indicou |
| Upline | Rede acima |
| Downline | Rede abaixo / Indicados |
| Binário | Estrutura de rede / Rede de equipe |
| Árvore binária | Estrutura da rede |
| Perna fraca / Perna forte | Lado de menor volume / Lado de maior volume |
| Pontos binários | Pontos de rede / Pontos de equipe |
| Bônus binário | Bônus de equipe |
| Bônus multinível | Bônus por indicação |
| Graduação / Carreira | Nível de parceria / Tier |
| Spillover | Realocação automática |
| Ativação / Qualificação | Adesão ao plano / Plano ativo |
| Fast Start | Bônus de Lançamento (primeiros 30 dias) |
| Recrutamento | Convite / Indicação |
| Rede MMN / Marketing Multinível | Programa de Parceria / Rede de Parceiros |

## Escopo dos arquivos

Edição **somente de textos visíveis** nos seguintes grupos:

### 1. Páginas públicas / Landing
- `src/pages/PartnerLanding.tsx`
- `src/components/Investir/InvestmentHero.tsx`
- `src/components/Investir/InvestmentBenefits.tsx`
- `src/components/Investir/InvestmentModel.tsx`
- `src/components/Investir/InvestmentTimeline.tsx`
- `src/components/Investir/InvestmentSimulator.tsx`
- `src/components/Investir/PlanComparison.tsx`
- `src/components/Investir/TestimonialCarousel.tsx`
- `src/components/Investir/InvestmentFAQ.tsx`
- `src/pages/Auth.tsx` (mensagens de cadastro com `ref`)
- `index.html` e `SEOHead` (title/description de /parceiro)

### 2. Dashboard do Parceiro (logado)
- `src/components/Partner/PartnerDashboard.tsx`
- `src/components/Partner/PartnerReferralSection.tsx`
- `src/components/Partner/BinaryNetworkTree.tsx`
- `src/components/Partner/BinaryBonusHistory.tsx`
- `src/components/Partner/ReferralNetworkTree.tsx`
- `src/components/Partner/FastStartProgress.tsx`
- `src/components/Partner/GraduationBadge.tsx`
- `src/components/Partner/PartnerLevelProgress.tsx`
- `src/components/Partner/SponsorActivateDialog.tsx`
- `src/components/Partner/PartnerPlanCard.tsx`
- `src/components/Partner/AdCenterDashboard.tsx`
- `src/components/ReferralBonusList.tsx`
- `src/components/UserProfileCard.tsx`

### 3. Painel Admin
- `src/components/Admin/AdminPartnerManagement.tsx`
- `src/components/Admin/AdminBinaryTreeView.tsx`
- `src/components/Admin/BinaryNetworkManager.tsx`
- `src/components/Admin/PartnerGraduationManager.tsx`
- `src/components/Admin/PartnerDetailModal.tsx`
- `src/components/Admin/PartnerCashflowDashboard.tsx`
- `src/components/Admin/PartnerAnalyticsCharts.tsx`
- `src/components/Admin/FastStartTiersManager.tsx`
- `src/components/Admin/ReferralLevelConfigManager.tsx`
- `src/components/Admin/AdminReferralBonusesTab.tsx`
- `src/components/Affiliate/Manager/ManagerRecruitmentLinkCard.tsx` (e similares)
- `src/components/AdminUserManagement.tsx`
- `src/pages/AdminParceiros.tsx`

### 4. E-mails transacionais
- `supabase/functions/send-email/_templates/welcome-email.tsx` (se mencionar patrocinador/rede)
- Demais templates serão lidos antes da edição para confirmar.

## Reforço de disclaimers

Em cada bloco onde a UI fala sobre bônus de rede / bônus de equipe / níveis / pontos de rede, adicionar (ou destacar, se já existir) um aviso curto e padronizado:

> *"Programa de parceria. Os repasses dependem do faturamento real da plataforma. Não há garantia de valor mínimo. Não é investimento financeiro."*

Pontos onde o disclaimer entra/é reforçado:
- `InvestmentBenefits` (seção de bônus de indicação)
- `PlanComparison` (rodapé dos cards)
- `PartnerReferralSection` (topo da seção)
- `BinaryNetworkTree` / `BinaryBonusHistory` (rodapé)
- `FastStartProgress` (rodapé)
- `InvestmentFAQ` — revisar respostas para remover qualquer termo de MMN remanescente.

Será criado **um componente reutilizável** `src/components/Partner/PartnershipDisclaimer.tsx` (variantes `inline` curto e `card` completo) para garantir consistência e facilitar manutenção futura.

## O que NÃO muda

- Nomes de tabelas, colunas, funções RPC, edge functions, hooks (`useBinaryNetwork`, `useFastStartProgress`, etc.) — apenas textos exibidos pelos componentes.
- Lógica de cálculo de bônus, regras de payout, validações.
- URLs, rotas, parâmetros de query (`?ref=...`).
- Identificadores em banco (`partner_level_points`, `binary_bonuses`, etc.).
- Memórias do projeto em `mem://` (termos técnicos internos continuam usando "binary", "sponsor" etc. para clareza de engenharia).

## Plano de execução

1. Criar `PartnershipDisclaimer.tsx`.
2. Reescrever páginas públicas (grupo 1) — maior impacto reputacional.
3. Reescrever dashboard do parceiro (grupo 2).
4. Reescrever painel admin (grupo 3).
5. Revisar e ajustar e-mails (grupo 4).
6. Busca final com `rg` pelos termos antigos em strings JSX para garantir cobertura.

## Risco

Baixo: alterações são exclusivamente de texto. Nenhuma mudança de schema, lógica ou contrato de API. Único risco é quebrar testes que verifiquem strings literais — será verificado ao final.
