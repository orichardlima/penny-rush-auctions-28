

## Aplicar a migration agora (nova tentativa)

API do Supabase pode ainda estar instável, mas vamos tentar.

### O que será executado

**1 única migration SQL** — cria as 2 funções de advisory lock que destravam o resto do plano:

```sql
CREATE OR REPLACE FUNCTION public.try_protection_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pg_try_advisory_lock(8675309); $$;

CREATE OR REPLACE FUNCTION public.release_protection_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pg_advisory_unlock(8675309); $$;

REVOKE ALL ON FUNCTION public.try_protection_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_protection_lock() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_protection_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_protection_lock() TO service_role;
```

### O que NÃO muda nesta etapa
- Nenhuma tabela alterada
- Nenhuma RLS modificada
- Nenhum dado movido
- Nenhum efeito sobre leilões, bots, pagamentos ou UI

### Próximos passos (após a migration passar)
1. Refatorar `supabase/functions/sync-timers-and-protection/index.ts` com lock + timeout 25s
2. Atualizar `src/hooks/useRealTimeProtection.ts` (remover/limitar a admin com intervalo 60s)
3. Validar logs da edge

### Se falhar de novo
Se a Management API retornar 503/timeout outra vez, eu te aviso imediatamente e podemos:
- Aguardar mais alguns minutos
- Você executar a SQL manualmente no SQL Editor do Supabase (link abaixo) — leva 5 segundos

