

## Correcao: Leiloes antigos aparecendo na home apos migration

### Problema

A migration que corrigiu o `company_revenue` fez UPDATE em todos os leiloes, atualizando automaticamente a coluna `updated_at` para o momento da execucao (2026-02-08 21:35:34). O filtro de exibicao de leiloes finalizados na home usa `updated_at` como referencia, fazendo com que leiloes finalizados ha meses (ex: iPhone 16 Pro Max de setembro 2025) voltassem a aparecer.

### Causa raiz

No arquivo `src/contexts/AuctionRealtimeContext.tsx`, linha 261, o filtro de leiloes finalizados usa `updated_at`:

```text
query = query.or(`status.in.(active,waiting),and(status.eq.finished,updated_at.gte.${cutoffTime},is_hidden.eq.false)`);
```

O campo `updated_at` pode mudar por qualquer motivo (migrations, edits administrativos), enquanto `finished_at` representa o momento real de encerramento do leilao.

### Solucao

Alterar o filtro no `AuctionRealtimeContext.tsx` para usar `finished_at` no lugar de `updated_at`:

```text
query = query.or(`status.in.(active,waiting),and(status.eq.finished,finished_at.gte.${cutoffTime},is_hidden.eq.false)`);
```

### Detalhes tecnicos

| Arquivo | Mudanca |
|---|---|
| `src/contexts/AuctionRealtimeContext.tsx` | Linha 261: trocar `updated_at.gte` por `finished_at.gte` |

### O que NAO muda

- Nenhuma outra funcionalidade e alterada
- O filtro de leiloes ativos e em espera permanece identico
- A logica de ordenacao permanece identica
- Nenhuma migration SQL e necessaria
- A configuracao `finished_auctions_display_hours` continua funcionando normalmente

### Resultado esperado

Apenas leiloes finalizados dentro do periodo configurado (ex: ultimas 48h baseado em `finished_at`) aparecerao na home. Leiloes antigos voltarao a ficar ocultos imediatamente.

