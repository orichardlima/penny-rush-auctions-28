

## Plano: Corrigir Arredondamento nos Exemplos por Plano

### Problema Identificado

Os valores de exemplo por plano na tabela de configuração de faturamento diário estão sendo arredondados para cima quando deveriam ser truncados para 2 casas decimais.

**Exemplo:**
- Legend: R$ 9.999 × 0,25% = 24,9975
- Atual (arredondamento): R$ 25,00
- Esperado (truncamento): R$ 24,99

---

### Análise Técnica

O `Intl.NumberFormat` usa arredondamento "half-up" por padrão:
- `24.9975` → `25.00` (arredonda 0.9975 para cima)

Em cálculos financeiros, geralmente se usa **truncamento** para não pagar mais do que o calculado.

---

### Solução

Modificar a função `formatPrice` local no componente `DailyRevenueConfigManager.tsx` para truncar o valor antes de formatar.

**Antes (linha 47-52):**
```typescript
const formatPrice = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
```

**Depois:**
```typescript
const formatPrice = (value: number) => {
  // Truncar para 2 casas decimais (não arredondar para cima)
  const truncatedValue = Math.floor(value * 100) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(truncatedValue);
};
```

---

### Resultado Esperado

| Plano | Aporte | 0,25% Atual | 0,25% Corrigido |
|-------|--------|-------------|-----------------|
| Start | R$ 499 | R$ 1,25 | R$ 1,24 |
| Pro | R$ 1.499 | R$ 3,75 | R$ 3,74 |
| Elite | R$ 2.999 | R$ 7,50 | R$ 7,49 |
| Master | R$ 4.999 | R$ 12,50 | R$ 12,49 |
| Legend | R$ 9.999 | R$ 25,00 | R$ 24,99 |

---

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Admin/DailyRevenueConfigManager.tsx` | Adicionar truncamento na função `formatPrice` (linhas 47-52) |

---

### Seção Técnica

A alteração será feita nas linhas 47-52 do arquivo `src/components/Admin/DailyRevenueConfigManager.tsx`:

```typescript
const formatPrice = (value: number) => {
  // Truncar para 2 casas decimais (não arredondar para cima)
  const truncatedValue = Math.floor(value * 100) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(truncatedValue);
};
```

Isso garantirá que valores como 24.9975 sejam exibidos como R$ 24,99 em vez de R$ 25,00.

