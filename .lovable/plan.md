

## Plano: Interface Unificada de Condições de Encerramento Automático

### Objetivo
Adicionar uma seção de "Condições de Encerramento" no gerador de lotes (`BatchAuctionGenerator`) que permita configurar três tipos de encerramento automático:
1. **Por Horário Limite** (`ends_at`) - Encerra em uma hora específica
2. **Por Meta de Receita** (`revenue_target`) - Encerra ao atingir receita X (já existe no sistema)
3. **Por Preço Máximo** - Novo campo: encerra quando `current_price` atingir um valor limite

---

### Análise do Sistema Atual

| Campo | Tabela | Status | Uso |
|-------|--------|--------|-----|
| `ends_at` | auctions | Existe ✓ | Não utilizado |
| `revenue_target` | auctions | Existe ✓ | Usado na proteção |
| `max_price` | - | Não existe ✗ | Precisa criar |

O campo `market_value` atualmente é usado como "preço máximo" na proteção, mas serve para outra finalidade. Precisamos de um campo dedicado `max_price`.

---

### Alterações Necessárias

#### 1. Migração de Banco de Dados

Adicionar novo campo `max_price` na tabela `auctions`:

```sql
ALTER TABLE auctions 
ADD COLUMN max_price numeric DEFAULT NULL;

COMMENT ON COLUMN auctions.max_price IS 'Preço máximo para encerramento automático do leilão';
```

---

#### 2. Interface do Gerador de Lotes

**Arquivo: `src/components/Admin/BatchAuctionGenerator.tsx`**

Adicionar nova seção "Condições de Encerramento" com:

```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Condições de Encerramento Automático                 │
├─────────────────────────────────────────────────────────┤
│ [ ] Encerrar por Horário Limite                         │
│     ┌──────────────────────────────────────┐            │
│     │ Horário limite: [ 22:00 ▼ ]          │            │
│     │ ⚠️ Aplica para todos os leilões       │            │
│     └──────────────────────────────────────┘            │
│                                                         │
│ [ ] Encerrar por Meta de Receita                        │
│     💡 Usa o valor configurado em cada template         │
│                                                         │
│ [ ] Encerrar por Preço Máximo                           │
│     ┌──────────────────────────────────────┐            │
│     │ Preço máximo: R$ [ 500,00 ]          │            │
│     │ ⚠️ Aplica para todos os leilões       │            │
│     └──────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

**Estados a adicionar:**

```tsx
// Estados para condições de encerramento
const [enableTimeLimit, setEnableTimeLimit] = useState(false);
const [timeLimitHour, setTimeLimitHour] = useState('22:00');

const [enableRevenueTarget, setEnableRevenueTarget] = useState(true); // Ativo por padrão

const [enableMaxPrice, setEnableMaxPrice] = useState(false);
const [maxPriceValue, setMaxPriceValue] = useState<number | null>(null);
```

**Modificação no handleGenerate:**

```tsx
const auctions = scheduledAuctions.map(({ template, startsAt }) => {
  // Calcular ends_at se limite de horário estiver ativo
  let endsAt = null;
  if (enableTimeLimit && timeLimitHour) {
    const [hours, minutes] = timeLimitHour.split(':').map(Number);
    const endDate = new Date(startsAt);
    endDate.setHours(hours, minutes, 0, 0);
    // Se o horário limite for antes do início, usar o dia seguinte
    if (endDate <= startsAt) {
      endDate.setDate(endDate.getDate() + 1);
    }
    endsAt = endDate.toISOString();
  }

  return {
    title: template.title,
    description: template.description,
    image_url: template.image_url,
    market_value: template.market_value,
    revenue_target: enableRevenueTarget ? template.revenue_target : null,
    starting_price: template.starting_price,
    current_price: template.starting_price,
    bid_increment: template.bid_increment,
    bid_cost: template.bid_cost,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt,
    max_price: enableMaxPrice ? maxPriceValue : null, // Novo campo
    status: 'waiting',
    time_left: 15,
    total_bids: 0,
    company_revenue: 0
  };
});
```

---

#### 3. Atualizar Edge Function de Proteção

**Arquivo: `supabase/functions/auction-protection/index.ts`**

Adicionar verificações para `ends_at` e `max_price`:

```tsx
// Verificar se horário limite foi atingido
if (auction.ends_at) {
  const endsAt = new Date(auction.ends_at);
  const now = new Date();
  if (now >= endsAt) {
    console.log(`⏰ [PROTECTION] Horário limite atingido para "${title}"`);
    // Finalizar leilão...
  }
}

// Verificar se preço máximo foi atingido
if (auction.max_price && current_price >= auction.max_price) {
  console.log(`💰 [PROTECTION] Preço máximo atingido para "${title}"`);
  // Finalizar leilão...
}
```

---

#### 4. Atualizar Sync Function

**Arquivo: `supabase/functions/sync-timers-and-protection/index.ts`**

Incluir `ends_at` e `max_price` na query de leilões ativos:

```tsx
const { data: activeAuctions } = await supabase
  .from('auctions')
  .select('id, title, current_price, market_value, company_revenue, revenue_target, last_bid_at, bid_increment, ends_at, max_price')
  .eq('status', 'active');
```

---

### Prévia da Interface Atualizada

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🚀 Gerar Leilões em Lote                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────┐  ┌─────────────────────────────────────┐│
│ │ 📦 Selecione os Produtos│  │ ⏰ Configurações de Tempo           ││
│ │ [Categoria: Todas ▼]    │  │ Início: [2024-01-26 14:00]          ││
│ │                         │  │ Intervalo: [30 minutos ▼]           ││
│ │ ☑ iPhone 15 Pro         │  │ ☐ Embaralhar ordem                  ││
│ │ ☑ MacBook Air M2        │  └─────────────────────────────────────┘│
│ │ ☐ PlayStation 5         │                                        │
│ │ ☐ Nintendo Switch       │  ┌─────────────────────────────────────┐│
│ │                         │  │ 🎯 Condições de Encerramento        ││
│ └─────────────────────────┘  │ ☐ Por Horário: [22:00 ▼]            ││
│                              │ ☑ Por Meta de Receita (do template) ││
│                              │ ☐ Por Preço Máximo: R$ [____]       ││
│                              └─────────────────────────────────────┘│
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ✅ Prévia dos Leilões (2)                                       │ │
│ │ [14:00] iPhone 15 Pro     📍 Meta: R$ 800 | Até: --             │ │
│ │ [14:30] MacBook Air M2    📍 Meta: R$ 1200 | Até: --            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                    [Cancelar] [🚀 Gerar 2 Leilões]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Resumo das Alterações

| Componente | Arquivo | Alteração |
|------------|---------|-----------|
| **Banco** | migration | Adicionar campo `max_price` |
| **Frontend** | BatchAuctionGenerator.tsx | Nova seção com 3 checkboxes + inputs |
| **Backend** | auction-protection/index.ts | Verificar `ends_at` e `max_price` |
| **Backend** | sync-timers-and-protection/index.ts | Incluir novos campos na query |

---

### Comportamento Esperado

| Condição | Gatilho | Resultado |
|----------|---------|-----------|
| **Horário limite** | `now() >= ends_at` | Leilão encerra automaticamente |
| **Meta de receita** | `company_revenue >= revenue_target` | Leilão encerra automaticamente |
| **Preço máximo** | `current_price >= max_price` | Leilão encerra automaticamente |

Todas as condições funcionam de forma **independente** - qualquer uma que for atingida primeiro encerra o leilão.

---

### Seção Técnica

**Imports adicionais em BatchAuctionGenerator.tsx:**
```tsx
import { Target, DollarSign, Clock3, AlertCircle } from 'lucide-react';
```

**Opções de horário limite:**
```tsx
const TIME_LIMIT_OPTIONS = [
  { value: '18:00', label: '18:00' },
  { value: '19:00', label: '19:00' },
  { value: '20:00', label: '20:00' },
  { value: '21:00', label: '21:00' },
  { value: '22:00', label: '22:00' },
  { value: '23:00', label: '23:00' },
  { value: '00:00', label: '00:00 (meia-noite)' },
];
```

**Validação do preço máximo:**
```tsx
// Garantir que max_price > starting_price do template
if (enableMaxPrice && maxPriceValue) {
  const minStartingPrice = Math.min(...selectedTemplates.map(t => t.starting_price));
  if (maxPriceValue <= minStartingPrice) {
    toast.error('Preço máximo deve ser maior que o preço inicial dos produtos');
    return;
  }
}
```

