

## Sistema de Gerente + Influencers no Programa de Afiliados

### Conceito
Criar uma hierarquia de dois níveis no sistema de afiliados existente, onde um **Gerente** pode recrutar **Influencers** que divulgam por ele. O Gerente ganha um override (comissão sobre a comissão) de cada venda gerada pelos seus Influencers.

### Estrutura de Banco de Dados

**Nova tabela: `affiliate_managers`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid (PK) | ID do registro |
| manager_affiliate_id | uuid (FK → affiliates) | Afiliado que é gerente |
| influencer_affiliate_id | uuid (FK → affiliates) | Afiliado recrutado como influencer |
| override_rate | numeric | % que o gerente ganha sobre a comissão do influencer |
| status | text | active / inactive |
| created_at | timestamptz | Data de vínculo |

**Alteração na tabela `affiliates`:**
- Novo campo `role` (text, default `'affiliate'`): valores possíveis `affiliate`, `manager`, `influencer`
- Novo campo `recruited_by_affiliate_id` (uuid, nullable, FK → affiliates): quem recrutou este influencer

### Fluxo de Comissionamento

1. **Influencer** compartilha seu link → indicado compra → comissão normal do influencer é gerada (ex: 10%)
2. **Sistema detecta** que o influencer tem um gerente vinculado
3. **Comissão override** é gerada automaticamente para o gerente (ex: 2% sobre o valor da venda, ou X% sobre a comissão do influencer)
4. Ambas as comissões seguem o fluxo existente: pendente → aprovada → disponível para saque

### Interface - Painel do Gerente

- Seção "Meus Influencers" no dashboard do afiliado (quando role = manager)
- Link de convite para recrutar influencers
- Tabela com: nome do influencer, código, total de vendas, comissões geradas, override recebido
- Métricas agregadas: total de influencers, receita total da rede, override acumulado

### Interface - Painel Admin

- Nova aba ou seção em `AdminAffiliateManagement` para gerenciar vínculos gerente↔influencer
- Botão para promover afiliado a gerente
- Configuração do override_rate por gerente
- Relatório de comissões com coluna indicando se é direta ou override

### Arquivos Impactados

- **Novo:** migração SQL para `affiliate_managers` + campo `role` em `affiliates`
- **Novo:** `src/hooks/useAffiliateManager.ts` — lógica de gestão de influencers
- **Editar:** `src/hooks/useAdminAffiliates.ts` — incluir gestão de vínculos e promoção
- **Editar:** `src/components/AdminAffiliateManagement.tsx` — nova aba/seção para gerentes
- **Editar:** `src/pages/AffiliateDashboard.tsx` — seção "Meus Influencers" para role=manager
- **Editar:** `src/utils/affiliateHelpers.ts` — lógica de convite de influencer
- **Editar ou criar:** trigger/função SQL para gerar comissão override automaticamente quando comissão de influencer é criada

### Regras de Negócio

- Um influencer só pode ter **um** gerente
- Um gerente pode ter **múltiplos** influencers
- O override é calculado sobre o valor da venda (não sobre a comissão do influencer), configurável por gerente
- Comissões override seguem o mesmo fluxo de aprovação das comissões normais
- Um afiliado comum pode ser promovido a gerente pelo admin

### Estimativa de Complexidade
- Migração de banco: 1 tabela nova + 2 campos + trigger + RLS
- Backend (hooks/lógica): 2 hooks novos/editados
- Frontend: 2-3 componentes novos + edições em 2 telas existentes

