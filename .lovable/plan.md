

# Mover "Economia" para a linha dos lances e tempo ativo

## Mudança

Transformar o grid de `grid-cols-2` em `grid-cols-3` e adicionar o "Economia: X% OFF" como terceiro item na mesma linha.

## Antes

```text
Economia:                    100% OFF   ← linha própria
✏ 2792 lances    ⏰ Ativo há 8h 10min   ← grid-cols-2
```

## Depois

```text
✏ 2792 lances    ⏰ Ativo há 8h 10min    100% OFF   ← grid-cols-3, tudo numa linha
```

## Alteração em `src/components/AuctionCard.tsx`

- **Remover** o bloco da "Economia" (linhas 282-285) que ocupa uma linha inteira
- **Alterar** o grid de `grid-cols-2` para `grid-cols-3` (linha 287)
- **Adicionar** o "Economia" como terceiro item do grid:
  ```tsx
  <div className="flex items-center justify-end text-muted-foreground">
    <span className="font-bold text-success">{calculateDiscount()}% OFF</span>
  </div>
  ```

Nenhum outro arquivo é alterado.

