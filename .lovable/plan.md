

# Aumentar Fontes do AuctionCard no Mobile

## Problema

As fontes ficaram pequenas demais no mobile após a compactação do card. Precisa aumentar levemente para melhorar legibilidade sem voltar a ocupar espaço excessivo.

## Alterações

### `src/components/AuctionCard.tsx`

Ajustar os tamanhos de fonte mobile (mantendo desktop igual):

| Elemento | Atual | Novo |
|---|---|---|
| Título (h3) | `text-base sm:text-lg` | `text-lg sm:text-xl` |
| "Preço atual:" label | `text-sm sm:text-base` | `text-sm sm:text-base` (manter) |
| Preço atual valor | `text-lg sm:text-2xl` | `text-xl sm:text-2xl` |
| "Valor na loja" linha | `text-xs sm:text-sm` | `text-sm sm:text-sm` |
| Valor na loja valor | `text-sm sm:text-lg` | `text-base sm:text-lg` |
| Métricas (status/participantes/OFF) | `text-xs sm:text-sm` | `text-sm sm:text-sm` |

### Nenhum outro arquivo alterado

