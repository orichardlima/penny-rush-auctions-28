

Vou planejar a expansão do sistema de afiliados em "Máquina de Aquisição". Preciso primeiro mapear o que já existe vs o que precisa ser criado, para evitar retrabalho e respeitar a regra do usuário ("não alterar UI/funcionalidades fora do escopo").

**Mapeamento rápido do estado atual (já confirmado nas mensagens anteriores):**
- ✅ `affiliates.role` (`affiliate` | `manager` | `influencer`)
- ✅ `affiliate_managers` (manager_affiliate_id, influencer_affiliate_id, override_rate, status)
- ✅ Trigger `trg_generate_override_commission` calcula override automaticamente
- ✅ `useAffiliateManager` + `useAdminAffiliateManagers` hooks
- ✅ UI admin de promoção/vinculação (`AdminAffiliateManagement` aba "Gerentes")
- ✅ `affiliate_referrals` (clicks + signups com `referred_user_id`)
- ✅ `affiliate_commissions` (purchases)
- ❌ Aba "Meus Influencers" no painel do próprio Manager
- ❌ Recrutamento automático via link `/afiliado?ref=CODE`
- ❌ Métricas por influencer (funil + conversão)
- ❌ Ranking interno
- ❌ Auditoria de mudanças no vínculo
- ❌ Status `paused` / `blocked` por influencer (só existe `active`)

Como o escopo é GRANDE, vou propor faseado e CONCISO, focando nas Fases 1+2 (núcleo) primeiro, e deixando 3+4 para iterações seguintes — assim entrego valor rápido e o usuário aprova step-by-step.

---

# 🚀 Plano: Expansão Sistema de Afiliados — "Máquina de Aquisição"

## 📊 Diagnóstico (o que já existe)

Boa parte da infraestrutura **já está pronta** (vide análise anterior). Vou aproveitar tudo e adicionar somente o que falta. **Nada da UI atual será alterado fora do escopo.**

| Já existe | Falta |
|---|---|
| Tabela `affiliate_managers` + RLS | Aba "Meus Influencers" no painel do Manager |
| Trigger override automático | Recrutamento auto via link `?ref=` |
| Admin promove/vincula | Métricas funil por influencer |
| `role = manager` funcional | Status `paused`/`blocked` |
| `affiliate_referrals` (clicks/signups) | Ranking + Auditoria |

---

## 🎯 Estratégia: 3 entregas incrementais

Vou implementar em **3 PRs sequenciais** para você validar cada um antes do próximo.

### **ENTREGA 1 — Núcleo do Manager (Fases 1 + 2)** ⭐ COMEÇAR AQUI

#### 1.1 Backend / Migration
- Adicionar coluna `source_manager_affiliate_id` em `affiliates` (recrutamento automático)
- Adicionar coluna `recruited_at` em `affiliates`
- Estender `affiliate_managers.status` para aceitar: `active` | `paused` | `blocked` | `pending`
- Criar tabela `affiliate_manager_audit` (quem vinculou/alterou, quando, valor antigo/novo)
- Função RPC `get_manager_influencer_metrics(manager_id)` — retorna funil agregado por influencer (cliques, signups, compradores únicos, volume, comissão, override, taxa conversão) usando `affiliate_referrals` + `affiliate_commissions`
- Ajustar trigger override para **NÃO comissionar** se vínculo estiver `paused` ou `blocked`

#### 1.2 Recrutamento automático via link
- Criar página `/afiliado?ref=CODE` (ou reaproveitar onboarding existente)
- No fluxo de criação de afiliado (`createAffiliateAccount`), ler cookie/URL `?ref=`, validar se é um `manager` ativo, e criar vínculo automático em `affiliate_managers` com `status='active'` (sem aprovação por enquanto, conforme prioridade do usuário)

#### 1.3 Frontend — Nova aba "Meus Influencers" (só aparece se `role = manager`)
- Componente `ManagerInfluencersTab.tsx`
- **Cards de KPIs:** total influencers, ativos, cliques, signups, compradores, volume R$, override total
- **Tabela:** nome, código, status, cliques, signups, compradores, conversão %, vendas R$, comissão gerada, override gerado, ações (pausar/ativar/ver detalhes)
- **Modal de detalhe:** funil visual (cliques → signups → compras) + financeiro

> ⚠️ Nada do `AffiliateDashboard` atual será alterado. Apenas adicionarei uma nova aba condicional ao lado das abas existentes.

---

### **ENTREGA 2 — Escala (Fase 3)** — após validação da Entrega 1
- Ranking interno (top 3 por vendas + por conversão)
- Biblioteca de materiais (aproveitar padrão do `AdCenterMaterialsManager` que já existe)
- Exibição clara do link individual `/afiliado?ref=CODE` por influencer
- Tabela `affiliate_clicks` dedicada (se necessário melhorar tracking; hoje usa `affiliate_referrals`)

---

### **ENTREGA 3 — Controle e Segurança (Fase 4)** — após Entrega 2
- Painel de auditoria para Manager + Admin
- Validações extras: 1 manager não vincula outro manager, manager não vincula a si mesmo (já existe parcialmente)
- Logs detalhados de mudança de override e status

---

## 🛠️ Detalhes técnicos da ENTREGA 1

### Arquivos a criar:
- `src/components/Affiliate/Manager/ManagerInfluencersTab.tsx`
- `src/components/Affiliate/Manager/InfluencerKPICards.tsx`
- `src/components/Affiliate/Manager/InfluencerTable.tsx`
- `src/components/Affiliate/Manager/InfluencerDetailModal.tsx`
- `src/hooks/useManagerInfluencerMetrics.ts`
- Migration SQL (colunas + função RPC + ajuste de trigger)

### Arquivos a tocar (mínimo):
- `src/pages/AffiliateDashboard.tsx` → adicionar 1 aba condicional `{isManager && <TabsTrigger value="influencers">}`
- `src/utils/affiliateHelpers.ts` → ler `?ref=` e criar vínculo auto
- `src/hooks/useReferralTracking.ts` → estender para detectar `?ref=manager_code` em rota de afiliado

### Regras de negócio respeitadas:
- ✅ Só 2 níveis (Manager → Influencer)
- ✅ Override sai da plataforma, não da comissão do influencer
- ✅ 1 influencer = 1 manager (constraint UNIQUE já existe)
- ✅ Manager não vincula outro manager (validação já existe + reforço)
- ✅ `paused`/`blocked` interrompem geração de override

---

## ❓ Confirmações antes de executar

1. **Aprovação automática ou manual?** O usuário pediu "preparado mas opcional". Vou implementar com `status='active'` direto (sem etapa de aprovação) por padrão, e deixar o campo `pending` disponível para ativar via system_setting depois.

2. **Recrutamento via link**: Vou usar a URL `/afiliado?ref=CODE`. Caso já exista uma rota similar de onboarding, reaproveito; caso contrário, crio rota nova.

3. **Status `paused`/`blocked`**: Vou aplicar no nível do `affiliate_managers.status` (não no `affiliates`), para não afetar o status global do afiliado.

Se concordar, **começo pela ENTREGA 1** assim que aprovar.

