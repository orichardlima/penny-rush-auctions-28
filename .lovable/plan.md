

# Finalização Imediata ao Entrar em "Verificando Lances Válidos"

## Problema

Quando o timer chega a 0, o card exibe "Verificando lances válidos" e fica aguardando o backend (edge function a cada 10s ou cron SQL) finalizar. Pode levar até 30s.

## Solução

Quando `isVerifying` fica `true` no `AuctionCard`, chamar diretamente a edge function `sync-timers-and-protection` para forçar a finalização imediata, e depois fazer `forceSync` para atualizar o estado local.

## Alterações

### 1. `src/components/AuctionCard.tsx`

Adicionar um `useEffect` que, ao detectar `isVerifying === true`:

1. Aguarda 1 segundo (para dar chance ao realtime de atualizar)
2. Chama `supabase.functions.invoke('sync-timers-and-protection')` para forçar o backend a processar o leilão
3. Após resposta, chama `forceSync()` para atualizar o contexto local
4. Se ainda estiver verificando, repete até **5 tentativas** com intervalo de 2s
5. Cleanup completo ao sair do estado ou desmontar

```typescript
useEffect(() => {
  if (!isVerifying) return;

  let cancelled = false;
  let count = 0;
  const maxCalls = 5;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const triggerFinalization = async () => {
    if (cancelled || count >= maxCalls) return;
    count++;
    try {
      await supabase.functions.invoke('sync-timers-and-protection', {
        body: { trigger: 'verifying_card', auction_id: id }
      });
    } catch {}
    if (!cancelled) {
      await forceSync();
    }
    if (!cancelled && count < maxCalls) {
      timeoutId = setTimeout(triggerFinalization, 2000);
    }
  };

  timeoutId = setTimeout(triggerFinalization, 1000);

  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}, [isVerifying]);
```

Isso garante que ao entrar em "Verificando", o frontend ativamente pede ao backend para finalizar o leilão (que sempre será com bot), eliminando a espera passiva.

### 2. `src/contexts/AuctionRealtimeContext.tsx`

Adicionar guard de reentrância no `fetchAuctions` (já planejado anteriormente):

- `isFetchingRef = useRef(false)` 
- Early return se já em execução
- `try/finally` para garantir reset do flag

Isso protege contra múltiplos cards chamando `forceSync` simultaneamente.

## Resultado

- Ao entrar em "Verificando", o card dispara a finalização em ~1s
- O backend garante atomicidade (`WHERE status='active' AND finished_at IS NULL`)
- Máximo de 5 chamadas espaçadas por 2s (10s total) — sem spam
- Guard de reentrância impede queries paralelas no contexto
- Se outra camada já finalizou, o update simplesmente não afeta nenhuma linha

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/AuctionCard.tsx` | useEffect com chamada ativa à edge function ao detectar verificação |
| `src/contexts/AuctionRealtimeContext.tsx` | Guard de reentrância no `fetchAuctions` |

