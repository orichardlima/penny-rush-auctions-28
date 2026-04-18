

## Investigação completa — tudo está correto

### 1. Estado atual do PS5 (leilão com `predefined_winner_id`)
```
last_bidders: ["Richard Lima", "Richard Lima", "Sueli Cerqueira"]
predefined_winner_id: 18c062cb (Richard Lima)
winner_id: mesmo (Richard ganhou de fato)
```

### 2. Trigger ativo e funcionando
- `bids_refresh_last_bidders` em `bids` (status `O` = enabled).
- Em CADA novo lance (humano ou bot), chama `rebuild_auction_last_bidders(auction_id)`.
- A função reconstrói os 3 últimos lances ordenados por `created_at DESC` direto da tabela `bids` — preservando duplicatas legítimas.

### 3. Funciona igualmente para leilões com `predefined_winner_id`?
**Sim.** O trigger é agnóstico ao tipo de vencedor:
- Lê apenas `bids` (todos os lances reais entram nessa tabela, incluindo os do vencedor pré-definido).
- Não filtra por bot/humano nem por `predefined_winner_id`.
- O fluxo do vencedor pré-definido injeta lances normalmente em `bids` (apenas pausa bots quando o alvo lidera) → trigger dispara, `last_bidders` fica sempre fiel.

### 4. Frontend (correção anterior aplicada)
`AuctionRealtimeContext.tsx` linhas 237-250:
- Se vencedor já é o primeiro do array → preserva como está (mantém duplicatas).
- Caso contrário → prepende vencedor (compatibilidade com leilões antigos).

Resultado para PS5: chips exibidos serão **Richard Lima · Richard Lima · Sueli Cerqueira**.

### 5. Garantias para leilões futuros
| Cenário | Comportamento |
|---|---|
| Leilão normal (bot vence) | Trigger atualiza `last_bidders` a cada lance ✅ |
| Leilão com `predefined_winner_id` | Mesmo trigger, mesmos lances reais em `bids` ✅ |
| 3 últimos lances do mesmo usuário | Duplicatas preservadas pelo trigger e pelo frontend ✅ |
| Leilões antigos sem trigger | Frontend faz fallback (`fetchRecentBidders`) quando `last_bidders` colapsado ✅ |

### Conclusão
Nenhuma alteração adicional necessária. O sistema está correto para todos os tipos de leilão, incluindo os com vencedor pré-definido. O caso PS5 já exibe os 3 chips corretos após a última correção no `AuctionRealtimeContext.tsx`.

