

# Fix: Leilões Não Carregam — Resiliência no Carregamento Inicial

## Problema

Quando a primeira chamada de `fetchAuctions` falha por erro de rede (comum durante rebuilds ou instabilidade transitória), os leilões ficam permanentemente vazios mostrando "Nenhum leilão disponível" até o próximo poll de emergência (5s) ou resync (60s) ter sucesso.

Adicionalmente, o Service Worker transforma erros de rede em erros diferentes ("FetchEvent.respondWith received an error"), o que pode dificultar o retry correto.

## Solução — 2 edições

### 1. Service Worker `public/sw.js` — Tratar erro em requests Supabase

Adicionar try/catch no handler de requests Supabase (linha 97-99) para evitar que o SW converta o erro:

```javascript
// DE:
if (request.url.includes('/api/') || request.url.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
}

// PARA:
if (request.url.includes('/api/') || request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(err => {
        return new Response(JSON.stringify({ message: err.message }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
}
```

### 2. `AuctionRealtimeContext.tsx` — Retry agressivo no load inicial

Após o primeiro `fetchAuctions` falhar (auctions ainda vazio), agendar retries rápidos (2s, 4s, 8s) até carregar:

No `useEffect` do setup do canal Realtime (linha 472), após `fetchAuctions()`, adicionar:

```typescript
fetchAuctions().then(() => {
  // Se falhou no primeiro load, retry agressivo
  const retryIfEmpty = (attempt: number) => {
    if (attempt > 3) return;
    setTimeout(() => {
      if (auctions.length === 0 && !isFetchingRef.current) {
        console.log(`🔁 [REALTIME-CONTEXT] Retry inicial #${attempt}`);
        fetchAuctions().then(() => retryIfEmpty(attempt + 1));
      }
    }, 2000 * Math.pow(2, attempt - 1)); // 2s, 4s, 8s
  };
  retryIfEmpty(1);
});
```

Nota: o `auctions.length` checado dentro do setTimeout lerá o valor atualizado via closure sobre o ref, não sobre o state (preciso ajustar para usar um ref).

Alternativa mais simples: usar um `hasLoadedRef` que só se torna true quando `setAuctions` é chamado com dados, e o retry checa esse ref.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `public/sw.js` | Error handling para requests Supabase |
| `src/contexts/AuctionRealtimeContext.tsx` | Retry agressivo no load inicial |

## Impacto

- Elimina o "FetchEvent.respondWith" error do Service Worker
- Carregamento inicial se recupera automaticamente em 2-8s após falha transitória
- Zero mudança visual ou funcional quando tudo está funcionando

