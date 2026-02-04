
# Central de Anuncios - Implementacao com Auto-Declaracao Simples

## Resumo

Sistema onde parceiros confirmam com um clique que divulgaram materiais promocionais da plataforma. Completar tarefas diarias desbloqueia uma porcentagem do repasse semanal (70% base + 30% variavel).

---

## Arquitetura do Sistema

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                           CENTRAL DE ANUNCIOS                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PARCEIRO                           ADMIN                                │
│  ┌─────────────────────────┐        ┌─────────────────────────┐         │
│  │ 1. Ve material do dia   │        │ 1. Cadastra materiais   │         │
│  │ 2. Baixa/copia conteudo │        │ 2. Define datas-alvo    │         │
│  │ 3. Posta nas redes      │        │ 3. Monitora confirmacoes│         │
│  │ 4. Clica "Confirmei"    │        └─────────────────────────┘         │
│  └───────────┬─────────────┘                                            │
│              │                                                           │
│              v                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    LOGICA DE DESBLOQUEIO                        │    │
│  │                                                                  │    │
│  │   Meta: 5 de 7 dias = 100% desbloqueado                         │    │
│  │   Formula: 70% (base) + (30% x completed_days / 5)              │    │
│  │                                                                  │    │
│  │   Exemplo: 3 dias completados                                   │    │
│  │   = 70% + (30% x 3/5) = 70% + 18% = 88% do repasse             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Parte 1: Banco de Dados

### Tabela `ad_center_materials`
Armazena materiais promocionais cadastrados pelo admin.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| title | text | Titulo do material |
| description | text | Legenda sugerida para redes sociais |
| image_url | text | URL da imagem/banner (Supabase Storage) |
| target_date | date | Data alvo para divulgacao (opcional) |
| is_active | boolean | Se o material esta disponivel |
| created_by | uuid | Admin que criou |
| created_at | timestamptz | Data de criacao |

### Tabela `ad_center_completions`
Registra confirmacoes diarias dos parceiros.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| partner_contract_id | uuid | FK para partner_contracts |
| material_id | uuid | FK para ad_center_materials (opcional) |
| completion_date | date | Data da confirmacao |
| social_network | text | Instagram, Facebook, WhatsApp, TikTok |
| confirmed_at | timestamptz | Timestamp da confirmacao |

**Constraint:** Unico por (partner_contract_id, completion_date) - apenas uma confirmacao por dia.

### Politicas RLS

- Parceiros podem ver/criar suas proprias confirmacoes
- Parceiros podem ver materiais ativos
- Admins tem acesso total

---

## Parte 2: Hook `useAdCenter.ts`

Novo hook para gerenciar toda a logica da Central de Anuncios.

### Funcoes principais:

```typescript
// Retorna material do dia (com target_date = hoje) ou material generico ativo
getTodayMaterial(): Material | null

// Retorna progresso semanal do parceiro
getWeekProgress(): {
  completedDays: number;      // Dias ja confirmados (0-7)
  requiredDays: number;       // Meta (5)
  unlockPercentage: number;   // Porcentagem desbloqueada (70-100)
  weekHistory: DayStatus[];   // Status de cada dia da semana
  canConfirmToday: boolean;   // Se ainda nao confirmou hoje
}

// Confirma divulgacao do dia
confirmCompletion(socialNetwork: string): Promise<boolean>

// Retorna todos os materiais ativos (para exibir galeria)
getActiveMaterials(): Material[]
```

---

## Parte 3: Componentes do Parceiro

### `AdCenterDashboard.tsx`
Componente principal exibido na nova aba do PartnerDashboard.

**Estrutura visual:**

```text
┌────────────────────────────────────────────────────────────────┐
│  CENTRAL DE ANUNCIOS                                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Progresso Semanal: 3/5 dias  ████████░░░░ 88%           │  │
│  │  70% base + 18% bonus = 88% do repasse desbloqueado      │  │
│  │  Complete mais 2 dias para desbloquear 100%!             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MATERIAL DE HOJE                                        │  │
│  │  ┌────────────┐                                          │  │
│  │  │  [IMAGEM]  │  Titulo do material                      │  │
│  │  │            │  Legenda sugerida para postar...         │  │
│  │  └────────────┘                                          │  │
│  │                                                          │  │
│  │  [Baixar Imagem]  [Copiar Legenda]                       │  │
│  │                                                          │  │
│  │  Onde voce divulgou?                                     │  │
│  │  (Instagram) (Facebook) (WhatsApp) (TikTok) (Outro)      │  │
│  │                                                          │  │
│  │                  [Confirmar Divulgacao]                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  HISTORICO DA SEMANA                                           │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐           │
│  │ Seg  │ Ter  │ Qua  │ Qui  │ Sex  │ Sab  │ Dom  │           │
│  │  ✓   │  ✓   │  ✓   │  -   │  -   │  -   │  -   │           │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### `AdCenterProgressCard.tsx`
Card com barra de progresso e calculo de porcentagem desbloqueada.

### `AdCenterMaterialCard.tsx`
Card do material do dia com botoes de baixar imagem e copiar legenda.

### `AdCenterWeekHistory.tsx`
Grid visual com status de cada dia da semana (confirmado, pendente, futuro).

---

## Parte 4: Componentes do Admin

### `AdCenterMaterialsManager.tsx`
Gerenciamento de materiais promocionais no painel admin.

**Funcionalidades:**
- Listar materiais ativos/inativos
- Criar novo material (upload de imagem, titulo, legenda, data-alvo)
- Editar/desativar material
- Ver estatisticas de confirmacoes por material

---

## Parte 5: Integracao com Repasse Semanal

### Modificacao em `partner-weekly-payouts/index.ts`

Antes de calcular o valor final do repasse, a edge function:

1. Busca contagem de dias confirmados na semana em `ad_center_completions`
2. Calcula porcentagem de desbloqueio: `70 + (30 * min(completed_days, 5) / 5)`
3. Aplica multiplicador ao valor do repasse

```typescript
// Buscar confirmacoes da semana
const { count: completedDays } = await supabase
  .from('ad_center_completions')
  .select('*', { count: 'exact', head: true })
  .eq('partner_contract_id', contract.id)
  .gte('completion_date', weekStartStr)
  .lte('completion_date', weekEndStr);

// Calcular multiplicador de desbloqueio
const effectiveDays = Math.min(completedDays || 0, 5);
const unlockPercentage = 70 + (30 * effectiveDays / 5);
const unlockMultiplier = unlockPercentage / 100;

// Aplicar ao valor final
const finalAmount = calculatedAmountAfterCaps * unlockMultiplier;
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useAdCenter.ts` | Hook com logica da Central |
| `src/components/Partner/AdCenterDashboard.tsx` | Dashboard principal |
| `src/components/Partner/AdCenterProgressCard.tsx` | Card de progresso |
| `src/components/Partner/AdCenterMaterialCard.tsx` | Card de material |
| `src/components/Partner/AdCenterWeekHistory.tsx` | Historico semanal |
| `src/components/Admin/AdCenterMaterialsManager.tsx` | Gerenciador admin |

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/Partner/PartnerDashboard.tsx` | Adicionar aba "Anuncios" na TabsList |
| `src/components/Admin/AdminPartnerManagement.tsx` | Adicionar aba para materiais |
| `supabase/functions/partner-weekly-payouts/index.ts` | Integrar calculo de desbloqueio |

---

## Migracao SQL

```sql
-- Tabela de materiais promocionais
CREATE TABLE ad_center_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  target_date date,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT timezone('America/Sao_Paulo', now()),
  updated_at timestamptz DEFAULT timezone('America/Sao_Paulo', now())
);

-- Tabela de confirmacoes diarias
CREATE TABLE ad_center_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_contract_id uuid NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
  material_id uuid REFERENCES ad_center_materials(id),
  completion_date date NOT NULL,
  social_network text NOT NULL,
  confirmed_at timestamptz DEFAULT timezone('America/Sao_Paulo', now()),
  UNIQUE(partner_contract_id, completion_date)
);

-- RLS para ad_center_materials
ALTER TABLE ad_center_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage materials" ON ad_center_materials
  FOR ALL USING (is_admin_user(auth.uid()));

CREATE POLICY "Partners can view active materials" ON ad_center_materials
  FOR SELECT USING (is_active = true);

-- RLS para ad_center_completions
ALTER TABLE ad_center_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own completions" ON ad_center_completions
  FOR SELECT USING (
    partner_contract_id IN (
      SELECT id FROM partner_contracts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Partners can insert own completions" ON ad_center_completions
  FOR INSERT WITH CHECK (
    partner_contract_id IN (
      SELECT id FROM partner_contracts 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

CREATE POLICY "Admins can manage completions" ON ad_center_completions
  FOR ALL USING (is_admin_user(auth.uid()));

-- Indices para performance
CREATE INDEX idx_completions_contract_date 
  ON ad_center_completions(partner_contract_id, completion_date);
CREATE INDEX idx_materials_target_date 
  ON ad_center_materials(target_date) WHERE is_active = true;
```

---

## Fluxo do Usuario

1. Parceiro acessa aba "Anuncios" no dashboard
2. Ve o progresso semanal (ex: "3/5 dias - 88% desbloqueado")
3. Ve material do dia (imagem + legenda sugerida)
4. Baixa imagem e/ou copia legenda
5. Posta nas redes sociais externas
6. Volta ao app e seleciona rede social usada
7. Clica "Confirmar Divulgacao"
8. Progresso atualiza instantaneamente
9. No domingo, repasse e calculado com multiplicador de desbloqueio

---

## Proximos Passos Apos Implementacao

- **Verificacao por Print:** Adicionar campo de upload de screenshot
- **Verificacao por IA:** Usar OpenAI Vision para validar prints
- **Gamificacao:** Ranking de parceiros mais engajados
- **Materiais Dinamicos:** Gerar materiais automaticamente com dados de leiloes
