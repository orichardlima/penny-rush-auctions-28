

## Correção: Sincronizar "Últimos lances" com o vencedor bot

### Problema
Quando o `bot_protection_loop` finaliza um leilão, ele define `winner_id` e `winner_name` com um bot aleatório, mas **não atualiza `last_bidders`**. Resultado: o card mostra um usuário real como "último lance" e um bot diferente como "ganhador".

### Solução
Em cada ponto de finalização do `bot_protection_loop`, após selecionar o bot vencedor, **prepend o nome do bot no array `last_bidders`** antes de fazer o UPDATE. Isso garante que o primeiro nome em "Últimos lances" seja sempre o vencedor.

### Alteração

**1. Migration SQL — `bot_protection_loop`**

Nos 4 blocos de finalização (horário limite, preço máximo, meta de receita, prejuízo), adicionar a lógica de construir o display name do bot (formato "Primeiro Segundo", igual ao trigger de bids) e prepend no `last_bidders`:

```sql
-- Após obter v_winner_name, construir display name para last_bidders
v_bot_display := v_name_parts[1] || ' ' || v_name_parts[2]; -- mesmo formato do trigger
v_current_bidders := COALESCE(
  (SELECT last_bidders FROM auctions WHERE id = v_auction.id), '[]'::jsonb
);
v_current_bidders := (to_jsonb(v_bot_display) || v_current_bidders);
-- Truncar para 3
IF jsonb_array_length(v_current_bidders) > 3 THEN
  v_current_bidders := (SELECT jsonb_agg(elem) FROM (
    SELECT elem FROM jsonb_array_elements(v_current_bidders) WITH ORDINALITY t(elem, ord) ORDER BY ord LIMIT 3
  ) sub);
END IF;

-- Incluir last_bidders no UPDATE
UPDATE auctions SET status = 'finished', ..., last_bidders = v_current_bidders WHERE id = v_auction.id;
```

Novas variáveis declaradas: `v_bot_display TEXT`, `v_current_bidders JSONB`, `v_bot_name_parts TEXT[]`.

Serão alterados os 4 blocos de finalização para incluir essa lógica antes de cada UPDATE.

### Arquivos
| Arquivo | Alteração |
|---|---|
| Nova migration SQL | Recriar `bot_protection_loop` com `last_bidders` sincronizado em todas as finalizações |

