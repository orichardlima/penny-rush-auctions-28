
## Plano: Adicionar Filtro de Status na Seleção de Leilões

### Objetivo
Adicionar um filtro por status (Todos / Ativos / Finalizados) na seção "Selecionar Leilão" dentro da aba "Detalhes Completos do Leilão" no painel administrativo.

---

### Visualização do Resultado

**Antes:**
```
┌─────────────────────────┐
│ ⚡ Selecionar Leilão    │
├─────────────────────────┤
│ [Nintendo Switch Lite]  │
│ [JBL BOOMBOX 3]         │
│ [Lenovo IdeaPad]        │
│ ...                     │
└─────────────────────────┘
```

**Depois:**
```
┌─────────────────────────┐
│ ⚡ Selecionar Leilão    │
├─────────────────────────┤
│ [Todos ▼] [Ativos] [Fin]│  ← Filtro segmentado
├─────────────────────────┤
│ [Nintendo Switch Lite]  │
│ [JBL BOOMBOX 3]         │
│ [Lenovo IdeaPad]        │
│ ...                     │
└─────────────────────────┘
```

---

### Alterações

**Arquivo: `src/components/AdminDashboard.tsx`**

**1. Adicionar novo estado para o filtro de status (próximo à linha 143):**

```tsx
const [auctionStatusFilter, setAuctionStatusFilter] = useState<'all' | 'active' | 'finished'>('all');
```

**2. Criar lista filtrada de leilões (antes do return, ou usando useMemo):**

```tsx
const filteredAuctionsForDetails = useMemo(() => {
  if (auctionStatusFilter === 'all') return auctions;
  return auctions.filter(auction => auction.status === auctionStatusFilter);
}, [auctions, auctionStatusFilter]);
```

**3. Adicionar import do useMemo (linha 1):**

```tsx
import React, { useState, useEffect, useMemo } from 'react';
```

**4. Modificar o CardHeader da seção "Selecionar Leilão" (linhas 883-888):**

Adicionar os botões de filtro segmentado dentro do header ou abaixo dele:

```tsx
<CardHeader className="pb-2">
  <CardTitle className="flex items-center gap-2">
    <Activity className="h-5 w-5" />
    Selecionar Leilão
  </CardTitle>
  <div className="flex gap-1 mt-2">
    <Button
      size="sm"
      variant={auctionStatusFilter === 'all' ? 'default' : 'outline'}
      onClick={() => setAuctionStatusFilter('all')}
      className="flex-1 text-xs"
    >
      Todos
    </Button>
    <Button
      size="sm"
      variant={auctionStatusFilter === 'active' ? 'default' : 'outline'}
      onClick={() => setAuctionStatusFilter('active')}
      className="flex-1 text-xs"
    >
      Ativos
    </Button>
    <Button
      size="sm"
      variant={auctionStatusFilter === 'finished' ? 'default' : 'outline'}
      onClick={() => setAuctionStatusFilter('finished')}
      className="flex-1 text-xs"
    >
      Finalizados
    </Button>
  </div>
</CardHeader>
```

**5. Atualizar o mapeamento para usar a lista filtrada (linha 890):**

```tsx
{filteredAuctionsForDetails.map((auction) => (
  // ... resto do código
))}
```

**6. Adicionar mensagem quando não houver resultados:**

```tsx
{filteredAuctionsForDetails.length === 0 ? (
  <div className="text-center text-muted-foreground py-4 text-sm">
    Nenhum leilão {auctionStatusFilter === 'active' ? 'ativo' : 'finalizado'} encontrado
  </div>
) : (
  filteredAuctionsForDetails.map((auction) => (
    // ... botões de leilão
  ))
)}
```

---

### Resumo das Mudanças

| Local | Alteração |
|-------|-----------|
| Linha 1 | Adicionar `useMemo` ao import |
| Linha ~143 | Novo state `auctionStatusFilter` |
| Antes do return | Criar `filteredAuctionsForDetails` com useMemo |
| Linhas 883-888 | Adicionar botões de filtro no CardHeader |
| Linha 890 | Usar `filteredAuctionsForDetails` no map |

---

### Benefícios

1. **Navegação rápida**: Filtrar entre ativos e finalizados facilita encontrar leilões específicos
2. **Consistência visual**: Usa o mesmo padrão de botões de filtro já existente no projeto (vide `userFilter`)
3. **UX melhorada**: Contador visual opcional para mostrar quantos leilões existem em cada categoria
