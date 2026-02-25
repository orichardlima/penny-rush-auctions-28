

# Mover tempo de atividade para ao lado dos lances totais

## Mudança

Colocar o "Ativo há Xh Xmin" (ou "Duração total: Xh Xmin") na mesma linha dos lances totais, dentro do `grid grid-cols-2` que já existe nas linhas 287-292.

## Antes (linhas 287-313)

```text
┌──────────────────────────────┐
│ ✏ 2778 lances                │  ← grid com 1 item só
├──────────────────────────────┤
│ ⏰ Ativo há 8h 6min           │  ← bloco separado abaixo
└──────────────────────────────┘
```

## Depois

```text
┌──────────────────────────────────────┐
│ ✏ 2778 lances    ⏰ Ativo há 8h 6min │  ← mesma linha no grid
└──────────────────────────────────────┘
```

Para leilões finalizados, a segunda coluna mostra "Duração: Xh Xmin" e a linha "Encerrado às..." fica abaixo do grid.

## Arquivo alterado

`src/components/AuctionCard.tsx` — linhas 287-313:
- Mover o conteúdo de "Ativo há" / "Duração total" para dentro do `grid grid-cols-2` como segundo item
- Remover o bloco separado que hoje ocupa uma linha própria
- Manter o "Encerrado às..." como linha separada para leilões finalizados (informação extra)

Nenhum outro arquivo é alterado.

