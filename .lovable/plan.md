

# Corrigir bot_protection_loop — leilões não finalizam

## Problema raiz

A migração anterior converteu `bot_protection_loop` de FUNCTION para PROCEDURE e adicionou `COMMIT` para liberar locks. Porém, o `pg_cron` no Supabase executa procedures dentro de uma transação gerenciada que **não permite** `COMMIT` explícito:

```
ERROR: invalid transaction termination
CONTEXT: PL/pgSQL function bot_protection_loop() line 131 at COMMIT
```

Isso faz com que o loop falhe **a cada minuto** e nenhum leilão seja finalizado automaticamente. Há 4 leilões "ativos" sem lance há dias.

## Solução

Reverter para `FUNCTION` (compatível com pg_cron) e remover o loop de 6 iterações com `pg_sleep`. Em vez disso, a function executa **uma única passagem** por minuto (já que o cron roda a cada minuto), eliminando a necessidade de `COMMIT` e `pg_sleep`.

### Migração SQL

1. Dropar a procedure atual
2. Recriar como `FUNCTION` com uma única passagem (sem loop de 6 iterações)
3. Atualizar o cron job para `SELECT public.bot_protection_loop()`

```sql
DROP PROCEDURE IF EXISTS public.bot_protection_loop();

CREATE OR REPLACE FUNCTION public.bot_protection_loop()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  -- mesmas variáveis, sem v_iteration
BEGIN
  v_current_time_br := timezone('America/Sao_Paulo', now());

  FOR v_auction IN SELECT ... FROM auctions WHERE status = 'active' LOOP
    -- mesma lógica de finalização e bots (sem mudanças)
    -- verificar ends_at, max_price, revenue_target
    -- thresholds 10s/13s para bots
    -- anti-spam, finalização por prejuízo
  END LOOP;
END;
$$;

-- Atualizar cron
SELECT cron.unschedule(48);
SELECT cron.schedule('bot-protection-loop', '* * * * *',
  'SELECT public.bot_protection_loop()');
```

### Impacto

- **Frequência**: Mantém execução a cada 1 minuto (via cron), porém sem as sub-iterações a cada 10s
- **Locks**: Sem `COMMIT` necessário — a function completa em poucos milissegundos
- **Compatibilidade**: `SELECT function()` é totalmente suportado pelo pg_cron no Supabase
- **Timeout anterior**: O problema original de timeout ao finalizar manualmente era causado por lock contention com o loop longo. Com uma única passagem rápida, o lock é mantido por milissegundos

### Seção técnica: por que remover o loop?

O loop de 6 iterações com `pg_sleep(10)` existia para simular execução a cada ~10 segundos dentro de um cron de 1 minuto. Sem `COMMIT`, o `pg_sleep` manteria locks por até 60 segundos — exatamente o problema original de timeout. A solução correta é executar uma passagem única e rápida a cada minuto.

