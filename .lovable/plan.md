

## Correções urgentes para eliminar a sobrecarga

### Diagnóstico (confirmado agora)

O banco já possui **2 cron jobs nativos** rodando a cada 1 minuto, que já cuidam de toda a lógica de bots e finalização:
- `bot-protection-loop` → `public.bot_protection_loop_safe()`
- `execute-overdue-bot-bids` → `public.execute_overdue_bot_bids_safe()`

Em paralelo, **cada cliente conectado** está chamando a edge function `sync-timers-and-protection` a cada **15 segundos** via `useRealTimeProtection`. Isso é a fonte primária de sobrecarga: cada usuário gera ~5.760 chamadas/dia que duplicam trabalho que o cron já está fazendo.

### Plano de correção (3 mudanças mínimas, zero impacto em UI/funcionalidade)

**1. Desativar a chamada do frontend (causa raiz da sobrecarga)**

Arquivo: `src/hooks/useRealTimeProtection.ts`
- Transformar o hook num **no-op** (corpo vazio, mantém a exportação para não quebrar imports).
- Resultado imediato: ~95% de redução nas invocações da edge function.

**2. Garantir frequência adequada do cron central**

Atualmente `bot-protection-loop` roda a cada 1 minuto. Como o ciclo natural de leilão é de 15s, vamos ajustar para rodar a cada 30s (2 jobs defasados) — ainda muito menor que a carga atual e suficiente para os bots agirem em janela aceitável:

```sql
-- Reagendar bot-protection-loop para rodar 2x por minuto (00s e 30s)
SELECT cron.unschedule('bot-protection-loop');
SELECT cron.schedule('bot-protection-loop-00', '* * * * *',
  $$ SELECT public.bot_protection_loop_safe(); $$);
SELECT cron.schedule('bot-protection-loop-30', '* * * * *',
  $$ SELECT pg_sleep(30); SELECT public.bot_protection_loop_safe(); $$);

-- Mesma coisa para execute-overdue-bot-bids
SELECT cron.unschedule('execute-overdue-bot-bids');
SELECT cron.schedule('execute-overdue-bot-bids-00', '* * * * *',
  $$ SELECT public.execute_overdue_bot_bids_safe(); $$);
SELECT cron.schedule('execute-overdue-bot-bids-30', '* * * * *',
  $$ SELECT pg_sleep(30); SELECT public.execute_overdue_bot_bids_safe(); $$);
```

**3. Criar advisory lock como rede de segurança**

Criar as 2 funções de lock que estavam pendentes (a migration que vinha falhando):

```sql
CREATE OR REPLACE FUNCTION public.try_protection_lock()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT pg_try_advisory_lock(8675309); $$;

CREATE OR REPLACE FUNCTION public.release_protection_lock()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT pg_advisory_unlock(8675309); $$;

REVOKE ALL ON FUNCTION public.try_protection_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_protection_lock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_protection_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_protection_lock() TO service_role;
```

### O que NÃO muda
- Nenhum componente visual
- Nenhuma RLS, tabela ou dado
- Nenhum fluxo de leilão, bot, pagamento, parceiro ou afiliado
- A edge function `sync-timers-and-protection` continua existindo (admin pode invocar manualmente se quiser)
- Os outros 6 cron jobs ficam intactos

### Impacto esperado
- **−95%** de invocações da edge function `sync-timers-and-protection`
- Eliminação de timeouts 504
- Eliminação da pressão de conexões na Management API
- Ciclo de bots mantém responsividade (30s no pior caso vs. 60s do cron atual sozinho — ainda dentro do timing humano dos bots)

### Ordem de execução
1. Migration SQL (lock + reagendamento dos 2 crons) — 1 chamada
2. Edit em `src/hooks/useRealTimeProtection.ts` — transformar em no-op

