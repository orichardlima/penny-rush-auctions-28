## Diagnóstico

`supabase--slow_queries` aponta um único ofensor dominante consumindo ~7 min de tempo total de execução do banco:

```sql
SELECT user_id, created_at FROM bids
WHERE auction_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```

- 1.420 chamadas, média 280–380 ms, pico de 6,5 s
- É a query que alimenta `useAuctionParticipants` (lista de últimos lances por leilão)
- Total combinado: ~426 segundos de CPU/IO — responsável pela saturação sinalizada no painel Supabase

### Por que está lenta

Os índices atuais em `bids` são:
- `idx_bids_auction_id` — só por auction_id
- `idx_bids_created_at` — só por created_at
- `idx_bids_user_id` — só por user_id

Nenhum cobre o padrão `WHERE auction_id=? ORDER BY created_at DESC`. O Postgres filtra pelo índice de `auction_id`, depois precisa carregar e ordenar milhares de linhas no heap (a tabela `bids` é a maior do banco). Em leilões quentes com 5–20k lances, isso vira leitura sequencial pesada.

## Solução

Criar um índice composto que sirva exatamente esse padrão:

```sql
CREATE INDEX idx_bids_auction_created_desc
  ON public.bids (auction_id, created_at DESC);
```

Com esse índice:
- A query vira um simples range scan + LIMIT — leitura de poucas páginas em vez de milhares
- Tempo médio esperado: <5 ms (vs 280 ms atual)
- Reduz I/O drasticamente — deve eliminar o alerta do Supabase sem precisar de upgrade de compute

## Detalhes técnicos

Migration única adicionando o índice. Não há mudança de schema, RLS, triggers, código frontend ou edge functions. Tudo continua funcionando idêntico — só fica mais rápido.

Após aplicar:
1. Aguardar 5–10 min para queries voltarem a rodar
2. Rerodar `slow_queries` para confirmar que o ofensor saiu do topo
3. Verificar no painel Supabase se o alerta de consumo sumiu

Se ainda houver saturação após esse índice, partimos para o próximo ofensor (próximas queries da lista são bem menores — `auctions` por status, `profiles` por user_id, `system_settings` por key, todas já indexadas e com tempo médio <5 ms).

## Fora de escopo

- Mudanças de UI, hooks, lógica de negócio
- Triggers, RLS, schema
- Upgrade de compute (só se otimização não bastar)
- Remoção dos índices redundantes (`idx_bids_created_at` sozinho fica obsoleto, mas remoção fica para outra rodada para minimizar risco)
