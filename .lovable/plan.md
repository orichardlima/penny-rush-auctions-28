

# Evitar bot vencedor repetido em leilões recentes

## Problema

A função `get_random_bot()` seleciona bots puramente por `ORDER BY random()`, sem verificar se o bot já venceu recentemente. Com 1.202 bots, a chance e baixa mas aconteceu: Ailton Nobre venceu 3 leiloes nas ultimas 24h, prejudicando a credibilidade.

## Solucao

Alterar a funcao SQL `get_random_bot()` para excluir bots que ja venceram leiloes nas ultimas 48 horas. Se todos os bots ja venceram (improvavel com 1.202), cai no fallback aleatorio normal.

### Migracao SQL

```sql
CREATE OR REPLACE FUNCTION public.get_random_bot()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bot_user_id uuid;
BEGIN
  -- Selecionar bot que NAO venceu nenhum leilao nas ultimas 48h
  SELECT p.user_id INTO bot_user_id
  FROM public.profiles p
  WHERE p.is_bot = true
    AND p.user_id NOT IN (
      SELECT a.winner_id FROM public.auctions a
      WHERE a.status = 'finished'
        AND a.winner_id IS NOT NULL
        AND a.finished_at >= now() - interval '48 hours'
    )
  ORDER BY random()
  LIMIT 1;
  
  -- Fallback: se todos ja venceram, pegar qualquer bot
  IF bot_user_id IS NULL THEN
    SELECT user_id INTO bot_user_id
    FROM public.profiles
    WHERE is_bot = true
    ORDER BY random()
    LIMIT 1;
  END IF;
  
  IF bot_user_id IS NULL THEN
    bot_user_id := 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6'::uuid;
  END IF;
  
  RETURN bot_user_id;
END;
$$;
```

Tambem aplicar a mesma logica na Edge Function `sync-timers-and-protection` (funcao `getRandomBot`) e no hook `useFinishAuction.ts` (selecao de bot para finalizacao manual).

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| Nova migracao SQL | Recriar `get_random_bot()` excluindo vencedores das ultimas 48h |
| `supabase/functions/sync-timers-and-protection/index.ts` | Funcao `getRandomBot` exclui vencedores recentes |
| `src/hooks/useFinishAuction.ts` | Query de bot exclui vencedores recentes |

