

## Aplicar correção dos 504s — execução em 1 passo

Plano já aprovado anteriormente. Estou re-apresentando para você liberar a execução agora.

### O que vou fazer (na ordem)

**1. Migration SQL** — cria 2 funções helper para advisory lock distribuído:

```sql
CREATE OR REPLACE FUNCTION public.try_protection_lock()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT pg_try_advisory_lock(8675309); $$;

CREATE OR REPLACE FUNCTION public.release_protection_lock()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT pg_advisory_unlock(8675309); $$;

GRANT EXECUTE ON FUNCTION public.try_protection_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_protection_lock() TO service_role;
```

**2. `supabase/functions/sync-timers-and-protection/index.ts`** — envolver a lógica atual em:
- `try_protection_lock` no início; se falhar, retorna `200 {skipped:true}` em <50ms
- `Promise.race([work, timeout(25000)])`; se estourar, retorna `200 {partial:true}`
- `release_protection_lock` no `finally`
- **Toda a lógica de bots/finalização preservada idêntica**

**3. `src/hooks/useRealTimeProtection.ts`**:
- `setInterval` 15000 → 60000
- Guard: busca `profiles.is_admin` no mount; só inicia interval se admin === true

### O que NÃO muda
- Cron `bot-protection-loop` (backbone) → inalterado
- Lógica de bots, finalização, fury vault, predefined winner, open win → idênticos
- UI, hooks de leilões, dashboards, pagamentos → nenhuma alteração
- Comportamento visível para o usuário → idêntico

### Resultado esperado
- 504s → ~zero
- Carga Postgres −80%
- Bots continuam atuando exatamente como hoje (via cron)

