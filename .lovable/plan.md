

# Aumentar Fontes e Card no Mobile

## Alterações em `src/components/AuctionCard.tsx`

| Elemento | Atual | Novo |
|---|---|---|
| Título (h3) | `text-lg sm:text-xl` | `text-xl sm:text-xl` |
| Descrição | `text-sm` | `text-sm sm:text-base` |
| "Preço atual:" label | `text-sm sm:text-base` | `text-base sm:text-base` |
| Preço atual valor | `text-xl sm:text-2xl` | `text-2xl sm:text-2xl` |
| "Valor na loja" linha | `text-sm sm:text-sm` | `text-sm sm:text-base` |
| Valor na loja valor | `text-base sm:text-lg` | `text-lg sm:text-lg` |
| Métricas (status/participantes/OFF) | `text-sm sm:text-sm` | `text-sm sm:text-base` |
| Padding do corpo | `p-3 sm:p-4` | `p-4 sm:p-5` |

Resumo: subir 1 nível de fonte em cada elemento no mobile e aumentar levemente o padding interno do card. Nenhum outro arquivo alterado.

