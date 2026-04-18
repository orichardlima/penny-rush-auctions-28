

## Causa raiz confirmada

Existem **2 triggers concorrentes** atualizando `auctions.last_bidders` em cada `INSERT` em `bids`:

1. **`update_auction_on_bid`** (antigo) — faz `prepend` do nome no array atual: `[novo, ...antigo].slice(0,3)`.
2. **`bids_refresh_last_bidders`** (recente, criado para corrigir colapso de duplicatas) — chama `rebuild_auction_last_bidders` que **reconstroi** o array dos 3 lances mais recentes via `SELECT … ORDER BY created_at DESC LIMIT 3`.

### Por que duplica

Quando 2 lances entram em janela curta (motor de bots agenda múltiplos quase ao mesmo tempo, como visto nos logs: `executados:3`, `executados:2`):

- Lance A (Nilza) é inserido. Trigger antigo prepend "Nilza" → `[Nilza, X, Y]`. Trigger novo reconstroi → `[Nilza, X, Y]`. OK.
- Lance B (Edvaldo) é inserido **antes** de A commitar visivelmente para B. Trigger antigo prepend "Edvaldo" sobre `[Nilza, X, Y]` → `[Edvaldo, Nilza, X]`. Trigger novo reconstroi do `bids` que agora tem A e B → `[Edvaldo, Nilza, X]`. OK aparente.
- Mas o trigger antigo **lê o snapshot antes** e o novo **lê após**. Em concorrência real (race condition Postgres com locks por linha em `auctions`), o segundo update às vezes sobrescreve com versão que tem nome duplicado.

Evidência empírica: **TODOS** os 3 leilões ativos têm o primeiro nome duplicado no `last_bidders`, mesmo quando o `bids` real mostra 4 usuários distintos nos últimos 4 lances. Isso é impossível com apenas o trigger novo agindo sozinho.

### A correção

Remover a parte de `last_bidders` do trigger antigo `update_auction_on_bid`, deixando apenas o trigger novo `bids_refresh_last_bidders` como única fonte de verdade.

## Plano

### Migration única
Recriar `update_auction_on_bid()` removendo TODA a lógica de cálculo/atualização de `last_bidders` (manter os outros campos: `current_price`, `total_bids`, `company_revenue`, `time_left`, `last_bid_at`, `updated_at`, `scheduled_bot_bid_at`, `scheduled_bot_band`). O trigger `bids_refresh_last_bidders` continua sendo o único responsável por `last_bidders`.

Sem mudanças em UI, fluxo, edge functions, ou demais tabelas. Sem mudanças nos leilões com vencedor pré-definido (regra independente).

### Resultado esperado
- Próximos lances atualizam `last_bidders` sem duplicar.
- Duplicatas legítimas (mesmo usuário 2 vezes seguidas) continuam preservadas, pois o `rebuild_auction_last_bidders` lê fielmente do `bids`.
- Leilões finalizados: comportamento atual mantido.

### Escopo
- 1 migration SQL (~30 linhas).
- 0 arquivos de frontend alterados.
- 0 edge functions alteradas.

