

## Aplicar correção dos 504s na edge `sync-timers-and-protection`

Implementação direta do plano aprovado, sem alterar UI nem lógica de leilões.

### Mudanças

**1. `supabase/functions/sync-timers-and-protection/index.ts`**

Envolver toda a lógica atual em:

- **Advisory lock distribuído** (`pg_try_advisory_lock(8675309)`) via uma RPC já existente OU criar uma função SQL helper se não houver. Se o lock não for adquirido, retorna `200 {skipped:true, reason:'locked'}` em <50 ms. Liberar em `finally` com `pg_advisory_unlock(8675309)`.
- **Timeout interno de 25 s** com `Promise.race([work(), timeout(25000)])`. Se estourar, retorna `200 {partial:true, timeout:true}` antes do edge runtime matar com 504.
- Toda a lógica atual (FASE 1/2/3) preservada **exatamente como está** — apenas envolvida pelo lock + race.

**2. `src/hooks/useRealTimeProtection.ts`**

- Aumentar `setInterval` de **15000 → 60000** (15s → 60s).
- Adicionar guard: só executa se o usuário for admin. Buscar `is_admin` da tabela `profiles` uma vez no mount; se `false`/null, não inicia o interval.
- Comportamento para usuários não-admin: hook retorna sem agendar nada (cron do DB cobre 100% dos casos).

### Migration necessária

Adicionar uma RPC SQL `try_protection_lock()` e `release_protection_lock()` que envelopam `pg_try_advisory_lock(8675309)` / `pg_advisory_unlock(8675309)`, retornando boolean. (Edge não pode chamar `pg_try_advisory_lock` diretamente via supabase-js — precisa de RPC.)

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

### O que NÃO muda

- Cron `bot-protection-loop` no Postgres → **inalterado** (continua sendo o backbone, roda 1×/min).
- Lógica de bots, finalização, agendamento de bandas, fury vault, predefined winner, open win mode → **idênticos**.
- Hooks de leilões (`useAuctionTimer`, `useAuctionData`, etc), UI de admin, dashboards, fluxo de pagamentos → **nenhuma alteração**.
- Comportamento visível dos leilões → **idêntico** (cron de 60 s já cobre tudo).

### Resumo técnico

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/migrations/<novo>.sql` | migration | Cria `try_protection_lock()` + `release_protection_lock()` |
| `supabase/functions/sync-timers-and-protection/index.ts` | edit | Envolve lógica em advisory lock + Promise.race timeout 25s |
| `src/hooks/useRealTimeProtection.ts` | edit | Intervalo 15s→60s + guard `is_admin` |

### Resultado esperado

- 504s → ~zero (lock evita concorrência, timeout interno garante resposta em <26s).
- Carga Postgres reduzida >80% (de N usuários × 4/min para 1/min global cron + 1/min/admin).
- Bots: **continuam atuando exatamente como hoje** via cron `bot-protection-loop`.

