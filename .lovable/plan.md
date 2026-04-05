

# Fix: AbortController + fetchIdRef no fetchAuctions

## Resumo

1 edição em `src/contexts/AuctionRealtimeContext.tsx`. Adicionar AbortController real com timeout de 12s e fetchIdRef para invalidar respostas antigas.

## Mudanças no `fetchAuctions` (linhas 271-368)

### 1. Adicionar ref

```typescript
const fetchIdRef = useRef(0);
```

### 2. Reescrever fetchAuctions

- Incrementar `fetchIdRef` no início
- Criar `AbortController` + `setTimeout(() => controller.abort(), 12000)`
- Passar `.abortSignal(controller.signal)` nas 3 queries:
  1. `system_settings` (linha 279)
  2. `auctions` query principal (linha 296)
  3. `profiles` batch de ganhadores (linha 312)
- Guard `fetchIdRef.current !== currentFetchId` antes de `setAuctions` e `setLoading`
- Catch separado para `AbortError` (warn, não error)
- No finally: `clearTimeout`, liberar `isFetchingRef` e `setLoading(false)` apenas se `fetchIdRef.current === currentFetchId`

### Código final do fetchAuctions

```typescript
const fetchIdRef = useRef(0);

const fetchAuctions = useCallback(async () => {
  if (isFetchingRef.current) return;
  isFetchingRef.current = true;

  const currentFetchId = ++fetchIdRef.current;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'finished_auctions_display_hours')
      .single()
      .abortSignal(controller.signal);

    // ... displayHours calc (inalterado)

    const { data, error } = await query
      .order('starts_at', { ascending: false, nullsFirst: false })
      .abortSignal(controller.signal);  // nota: encadear no final da query

    // ... error check (inalterado)

    // Batch profiles
    if (winnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, city, state')
        .in('user_id', winnerIds)
        .abortSignal(controller.signal);
      // ...
    }

    // Guard: descartar se fetchId expirou
    if (fetchIdRef.current !== currentFetchId) {
      console.log('🚫 [REALTIME-CONTEXT] Resposta descartada (fetchId expirado)');
      return;
    }

    // ... Promise.all, sort, filter (inalterado)

    setAuctions(visibleAuctions);
    hasLoadedRef.current = visibleAuctions.length > 0;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('⏰ [REALTIME-CONTEXT] fetchAuctions abortado por timeout de 12s');
    } else {
      console.error('❌ [REALTIME-CONTEXT] Erro:', error);
    }
  } finally {
    clearTimeout(timeoutId);
    if (fetchIdRef.current === currentFetchId) {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }
}, []);
```

## Cuidados solicitados pelo usuário

1. **setLoading(false) protegido por fetchId** — sim, no finally, tanto `isFetchingRef` quanto `setLoading` ficam dentro do guard `fetchIdRef.current === currentFetchId`
2. **Todas as queries com abortSignal** — as 3 queries (settings, auctions, profiles) recebem `.abortSignal(controller.signal)`

## Nota sobre `.abortSignal()` encadeado na query com `.or()`

A query de auctions usa `query = supabase.from(...).select(*)` e depois `query = query.or(...)`. O `.abortSignal()` será adicionado no final, junto com `.order()`, antes do `await`.

## Arquivo alterado

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/AuctionRealtimeContext.tsx` | AbortController 12s + fetchIdRef + proteção em setLoading |

