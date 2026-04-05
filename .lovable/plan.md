

# Contenção: Remover Sleep/Shuffle + Polling 30s + Timeout 20s

## Resumo

3 edições cirúrgicas em 3 arquivos + re-deploy da edge function. Zero mudança funcional ou de UI.

## 1. Edge Function `supabase/functions/sync-timers-and-protection/index.ts`

### Remover funções `getRandomDelay` e `sleep` (linhas 8-14)

Deletar completamente essas duas funções — não são mais usadas em nenhum outro lugar do arquivo.

### Remover shuffle e sleep no loop (linhas 206-214)

```typescript
// DE:
const shuffledAuctions = [...activeAuctions].sort(() => Math.random() - 0.5);

for (let i = 0; i < shuffledAuctions.length; i++) {
  const auction = shuffledAuctions[i];

  if (i > 0) {
    const delay = getRandomDelay(500, 1500);
    await sleep(delay);
  }

// PARA:
for (let i = 0; i < activeAuctions.length; i++) {
  const auction = activeAuctions[i];
```

## 2. Frontend Polling `src/hooks/useRealTimeProtection.ts` (linha 26)

```typescript
// DE:
intervalRef.current = setInterval(callProtectionSystem, 7000);
// PARA:
intervalRef.current = setInterval(callProtectionSystem, 30000);
```

## 3. Frontend Timeout `src/contexts/AuctionRealtimeContext.tsx`

### Linha 282 — timeout 12s para 20s

```typescript
// DE:
const timeoutId = setTimeout(() => controller.abort(), 12000);
// PARA:
const timeoutId = setTimeout(() => controller.abort(), 20000);
```

### Linhas 307-310 — detectar AbortError no retorno da query

```typescript
// DE:
if (error) {
  console.error('❌ [REALTIME-CONTEXT] Erro ao buscar leilões:', error);
  return;
}
// PARA:
if (error) {
  if (error.code === '20' || error.message?.includes('AbortError')) {
    console.warn('⏰ [REALTIME-CONTEXT] fetchAuctions abortado por timeout');
  } else {
    console.error('❌ [REALTIME-CONTEXT] Erro ao buscar leilões:', error);
  }
  return;
}
```

### Linhas 379-380 — catch block com detecção ampliada

```typescript
// DE:
if (error instanceof DOMException && error.name === 'AbortError') {
  console.warn('⏰ [REALTIME-CONTEXT] fetchAuctions abortado por timeout de 12s');
// PARA:
if ((error instanceof DOMException && error.name === 'AbortError') || 
    (error && typeof error === 'object' && (error.code === '20' || error.message?.includes('AbortError')))) {
  console.warn('⏰ [REALTIME-CONTEXT] fetchAuctions abortado por timeout de 20s');
```

## 4. Re-deploy

Deploy da edge function `sync-timers-and-protection` após a edição.

## Impacto esperado

- Edge function executa em < 2s (sem sleep de N x 1s)
- ~75% menos chamadas por cliente (30s vs 7s)
- Banco libera conexões, auth e home voltam a funcionar
- AbortErrors não poluem logs

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-timers-and-protection/index.ts` | Remover `getRandomDelay`, `sleep`, shuffle e delay entre leilões |
| `src/hooks/useRealTimeProtection.ts` | Polling 7000 → 30000 |
| `src/contexts/AuctionRealtimeContext.tsx` | Timeout 12s → 20s + AbortError detection fix |

