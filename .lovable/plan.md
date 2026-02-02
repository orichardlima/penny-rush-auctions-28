
## Plano: Corrigir Problema de Fuso Horário na Exibição de Datas

### Problema Identificado

O dashboard do parceiro está mostrando datas incorretas (um dia a menos) devido à interpretação UTC quando strings de data no formato `YYYY-MM-DD` são passadas para `new Date()`.

**Exemplo:**
- Banco de dados: `period_start: 2026-01-26`
- Exibição atual: `25/01 - 31/01` ❌
- Exibição correta: `26/01 - 01/02` ✅

### Causa Técnica

Quando JavaScript recebe `new Date("2026-01-26")`, ele interpreta como meia-noite UTC. No Brasil (UTC-3), isso resulta em `25/01/2026 às 21:00`, causando o deslocamento de um dia.

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/Partner/PartnerDashboard.tsx` | Corrigir todas as instâncias de parsing de datas |

---

### Solução

Reutilizar as funções auxiliares já existentes no projeto:

```typescript
// Já existem em src/hooks/useAdminPartners.ts
import { parseLocalDate, formatWeekRange } from '@/hooks/useAdminPartners';
```

### Alterações Específicas

**1. Remover função `formatPeriod` local (linhas 304-309)**
Substituir pela função `formatWeekRange` já existente e validada.

**2. Corrigir `chartData` (linha 265)**
```typescript
// Antes (com bug)
const start = new Date(p.period_start);

// Depois (corrigido)
const start = parseLocalDate(p.period_start);
```

**3. Corrigir histórico de payouts (linhas 876-877)**
```typescript
// Antes (com bug)
const start = new Date(payout.period_start);
const end = payout.period_end ? new Date(payout.period_end) : ...

// Depois (corrigido)
const start = parseLocalDate(payout.period_start);
const end = payout.period_end ? parseLocalDate(payout.period_end) : ...
```

---

### Resumo das Mudanças

1. Adicionar import de `parseLocalDate` e `formatWeekRange` do `useAdminPartners`
2. Remover a função `formatPeriod` duplicada 
3. Corrigir 3 pontos onde `new Date(period_start)` causa o bug de timezone
4. Usar `formatWeekRange` para exibição consistente de períodos

---

### Resultado Esperado

Após a correção, os períodos serão exibidos corretamente:
- `26/01 - 01/02/2026` ✅

Isso garante consistência com o que está salvo no banco de dados e com a lógica da Edge Function de processamento de repasses.
