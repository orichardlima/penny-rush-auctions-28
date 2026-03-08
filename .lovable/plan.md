

## Plano: Ocultar leilões finalizados sem lances da home

### Problema
Leilões finalizados com 0 lances (suspensos manualmente) aparecem na página inicial, gerando confusão.

### Solução
Adicionar filtro no query de busca dos leilões (`useAuctionData.ts`) para excluir leilões finalizados que tenham `total_bids = 0`.

### Alteração

**Arquivo: `src/hooks/useAuctionData.ts`** — na função `fetchAuctions`, ajustar o filtro OR para incluir a condição `total_bids.gt.0` nos leilões finalizados:

```
// De:
status.eq.finished,finished_at.gte.${cutoffTime},is_hidden.eq.false

// Para:
status.eq.finished,finished_at.gte.${cutoffTime},is_hidden.eq.false,total_bids.gt.0
```

Uma única linha alterada. Sem mudanças no frontend ou UI.

