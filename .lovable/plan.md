

## Plano: Controle de frequência por item premium na criação automática de leilões

### Problema
Hoje em `auto-replenish-auctions/index.ts` os templates ativos são embaralhados aleatoriamente (`Math.random()`) e selecionados sem considerar valor de mercado nem histórico recente. Itens caros (iPhone, etc.) podem cair no sorteio várias vezes seguidas, comprometendo a sustentabilidade financeira.

### Solução proposta: sistema de "tier" + cooldown por template

Adicionar dois controles complementares no `product_templates`:

**1. Tier de raridade (peso no sorteio)**
- Campo `tier text` com valores: `standard` (padrão), `premium`, `luxury`
- Cada tier tem um peso de sorteio configurável em `system_settings`:
  - `auto_replenish_weight_standard` (padrão: 10)
  - `auto_replenish_weight_premium` (padrão: 3)
  - `auto_replenish_weight_luxury` (padrão: 1)
- Sorteio passa a ser **ponderado**: itens luxury têm 10x menos chance que standard

**2. Cooldown mínimo entre aparições**
- Campo `min_hours_between_appearances integer` no template (default: 0, ou seja, sem restrição)
- Sugestão de uso: standard=0h, premium=24h, luxury=72h
- Antes de sortear, filtrar templates cujo último leilão (criado/finalizado) é mais recente que esse cooldown
- Usa `auctions` filtrando por `title = template.title` e `created_at >= now() - interval`

**3. Classificação automática (opcional, na migração)**
- Sugerir tier baseado em `market_value` para popular dados existentes:
  - `< R$ 500` → standard
  - `R$ 500 - R$ 2000` → premium
  - `> R$ 2000` → luxury
- Admin pode ajustar manualmente depois

### Mudanças

**Migração de banco:**
- `product_templates`: adicionar `tier text default 'standard'` e `min_hours_between_appearances integer default 0`
- `system_settings`: inserir 3 chaves de peso (standard/premium/luxury)
- Seed: classificar templates existentes pelo `market_value`

**Edge Function `auto-replenish-auctions/index.ts`:**
- Buscar pesos do `system_settings`
- Após filtrar templates não duplicados, aplicar **filtro de cooldown** (consultar `auctions` por título + janela temporal)
- Substituir `sort(() => Math.random() - 0.5)` por **sorteio ponderado** usando os pesos do tier
- Logar tier sorteado para auditoria

**UI Admin (`ProductTemplatesManager.tsx`):**
- Adicionar select de **Tier** (Standard / Premium / Luxury) no formulário
- Adicionar input numérico **"Horas mínimas entre aparições"**
- Mostrar coluna Tier na lista de templates (badge colorido)

**UI Admin (configurações):**
- Em algum painel de configurações de auto-replenish, mostrar 3 inputs para os pesos por tier

### Diagrama do sorteio

```text
Templates ativos (N)
  ↓ remove títulos já em uso
  ↓ remove templates em cooldown (último uso < min_hours)
  ↓ pool elegível
  ↓ sorteio ponderado (luxury=1, premium=3, standard=10)
  ↓ N selecionados (até batch_size)
```

### Fora de escopo
- Não altera duração, intervalo ou batch size
- Não altera lógica de bots / vencedores
- Não altera UI do usuário final
- Não toca em `product_templates.times_used` (continua incrementando)

### Resultado esperado
iPhones e outros itens caros aparecem proporcionalmente menos no carrossel automático, com janela mínima de descanso entre aparições. Admin controla a distribuição via tier do template e pesos globais nas configurações.

