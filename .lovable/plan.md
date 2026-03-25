

# Deduplicar vencedores na seção "Vencedores Recentes"

## Mudança

No hook `useRecentWinners.ts`:
- Aumentar `limit` da query de 6 para 12
- Após formatar os vencedores, deduplicar por `winner_id` (manter apenas a vitória mais recente de cada pessoa)
- Limitar resultado final a 6

| Arquivo | Mudança |
|---|---|
| `src/hooks/useRecentWinners.ts` | Deduplicar por winner_id, aumentar limit |

