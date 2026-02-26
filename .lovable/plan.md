

# Limitar descrição do produto no card de leilão

## Problema

A descrição do produto é exibida sem limite de linhas no `AuctionCard`, ocupando espaço vertical excessivo — especialmente em mobile.

## Solução

Truncar a descrição para no máximo **2 linhas** usando `line-clamp-2`, adicionando reticências automáticas quando o texto ultrapassar o limite.

### Alteração: `src/components/AuctionCard.tsx` (linhas 250-254)

**De:**
```jsx
{description}
```

**Para:**
```jsx
{description && (
  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
    {description}
  </p>
)}
```

### Resultado
- Descrição limitada a 2 linhas com reticências (`...`) automáticas
- Economia significativa de espaço vertical nos cards
- Texto completo continua visível na view de detalhes do leilão
- Nenhuma outra alteração de UI ou funcionalidade

