

## Plano: Corrigir Arredondamento no Dashboard do Parceiro

### Problema Identificado

Os valores diários exibidos no dashboard do parceiro estão sendo arredondados para cima em vez de truncados. Na imagem:

| Dia | Porcentagem | Valor Exibido | Valor Correto (truncado) |
|-----|-------------|---------------|-------------------------|
| Seg 26 | 0,3% | R$ 30,00 | R$ 29,99 |
| Ter 27 | 0,18% | R$ 18,00 | R$ 17,99 |
| Qua 28 | 0,25% | R$ 25,00 | R$ 24,99 |

**Cálculo (Legend R$ 9.999):**
- 9.999 × 0,30% = 29,997 → truncado = R$ 29,99
- 9.999 × 0,18% = 17,9982 → truncado = R$ 17,99
- 9.999 × 0,25% = 24,9975 → truncado = R$ 24,99

---

### Causa Raiz

O arquivo `src/components/Partner/PartnerDashboard.tsx` possui sua própria função `formatPrice` local (linhas 289-294) que **não aplica truncamento**:

```typescript
const formatPrice = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value); // ← Arredonda para cima
};
```

A correção anterior foi feita apenas no painel admin (`DailyRevenueConfigManager.tsx`), mas não no dashboard do parceiro.

---

### Solução

Aplicar a mesma lógica de truncamento na função `formatPrice` do `PartnerDashboard.tsx`:

**Antes:**
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

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Partner/PartnerDashboard.tsx` | Adicionar truncamento na função `formatPrice` (linhas 289-294) |

---

### Resultado Esperado

Após a correção, os valores exibidos serão:

| Dia | Porcentagem | Valor Correto |
|-----|-------------|---------------|
| Seg 26 | 0,3% | R$ 29,99 |
| Ter 27 | 0,18% | R$ 17,99 |
| Qua 28 | 0,25% | R$ 24,99 |

---

### Consideração Adicional

Pode ser interessante futuramente centralizar a função `formatPrice` com truncamento no arquivo `src/lib/utils.ts` para evitar duplicação de código. A função global atual (utils.ts) também não tem truncamento. Porém, para manter o escopo mínimo desta correção, alteraremos apenas o `PartnerDashboard.tsx` conforme solicitado.

---

### Seção Técnica

Alteração nas linhas 289-294 de `src/components/Partner/PartnerDashboard.tsx`:

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

