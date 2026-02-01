
## Plano: Remover Truncamento e Voltar ao Arredondamento Padrão

### Alterações

Reverter a função `formatPrice` em ambos os arquivos para usar o arredondamento padrão do `Intl.NumberFormat`.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Partner/PartnerDashboard.tsx` | Remover truncamento (linhas 289-298) |
| `src/components/Admin/DailyRevenueConfigManager.tsx` | Remover truncamento (linhas 47-56) |

---

### Resultado

| Plano | Aporte | 0,25% Atual (truncado) | 0,25% Após (arredondado) |
|-------|--------|------------------------|--------------------------|
| Start | R$ 499 | R$ 1,24 | R$ 1,25 |
| Legend | R$ 9.999 | R$ 24,99 | R$ 25,00 |

---

### Seção Técnica

**PartnerDashboard.tsx (linhas 289-298):**

```typescript
// Antes (com truncamento)
const formatPrice = (value: number) => {
  const truncatedValue = Math.floor(value * 100) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(truncatedValue);
};

// Depois (arredondamento padrão)
const formatPrice = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
```

**DailyRevenueConfigManager.tsx (linhas 47-56):**

```typescript
// Antes (com truncamento)
const formatPrice = (value: number) => {
  const truncatedValue = Math.floor(value * 100) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(truncatedValue);
};

// Depois (arredondamento padrão)
const formatPrice = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
```
