

## Plano: Corrigir bot_protection_loop travado por conflito com trigger

### Problema
O `bot_protection_loop` falha a cada execução porque tenta inserir um lance de bot em leilões cujo `ends_at` já passou. O trigger `prevent_bids_on_inactive_auctions` bloqueia essa inserção, causando rollback de toda a transação. Nenhum leilão é processado.

**Erro**: `Cannot place bids on inactive or finished auctions` — repetido a cada minuto desde pelo menos 11:49.

### Solução
Modificar a função `bot_protection_loop` para **não inserir lances de bot** quando `ends_at` já passou. Em vez de inserir um bid de proteção, finalizar diretamente com o bot como "vencedor" (sem registro de bid). Isso evita o conflito com o trigger e permite que todos os leilões sejam processados normalmente.

### Alteração (migração SQL)

Na seção de finalização por `ends_at` com receita insuficiente e último lance de usuário real (linhas 68-88 da função), substituir o bloco que insere bid + finaliza por um bloco que apenas finaliza com o bot como vencedor, sem inserir bid:

```sql
-- ANTES (causa erro):
-- INSERT INTO bids (...) VALUES (...);  -- bloqueado pelo trigger
-- UPDATE auctions SET status = 'finished' ...

-- DEPOIS (sem inserir bid):
SELECT public.get_random_bot() INTO v_bot_user_id;
IF v_bot_user_id IS NOT NULL THEN
  SELECT full_name INTO v_winner_name FROM profiles WHERE user_id = v_bot_user_id;
  UPDATE auctions SET status = 'finished', finished_at = v_auction.ends_at,
    winner_id = v_bot_user_id, winner_name = v_winner_name
  WHERE id = v_auction.id;
END IF;
```

Nenhuma alteração no frontend ou em outros componentes.

