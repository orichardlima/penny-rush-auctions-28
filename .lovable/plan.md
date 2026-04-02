

# Compactar AuctionCard para Caber na Tela

## Problema

O layout vertical (status, participantes, tempo em linhas separadas) ocupa muito espaço, fazendo o card não caber inteiro na tela, especialmente em dispositivos menores.

## Alterações

### `src/components/AuctionCard.tsx`

**1. Compactar a seção de métricas (status + participantes + tempo) em uma única linha horizontal:**

Substituir o layout `flex-col gap-1` (linhas 309-327) por uma única linha `flex-wrap` horizontal:

```
🔥 Disputa intensa · 👥 +300 participantes · ⏱ 1h 24min
```

Tudo na mesma linha, separado por "·", com wrap para telas muito pequenas.

**2. Reduzir paddings e margins gerais:**
- Padding do corpo: `p-3 sm:p-4` (era `p-3 sm:p-6`)
- Espaçamento entre itens: `space-y-1.5 sm:space-y-2` (era `space-y-2 sm:space-y-3`)
- Margin do título: `mb-1 sm:mb-2` (era `mb-2 sm:mb-3`)
- Margin do FuryVault: `mb-2` (era `mb-3`)

**3. Reduzir aspect ratio da imagem:**
- De `aspect-[4/3]` para `aspect-[16/10]` — imagem mais larga e menos alta

**4. Reduzir tamanhos de fonte em mobile:**
- Preço atual: `text-lg sm:text-2xl` (era `text-xl sm:text-2xl`)
- Valor na loja: manter `text-xs sm:text-sm`

### Nenhum outro arquivo alterado

