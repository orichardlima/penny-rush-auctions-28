

# Ajuste de Thresholds e Polling — 3 Edições Pontuais

## Resumo

3 edições cirúrgicas em 3 arquivos. Sem nova arquitetura, sem nova complexidade.

## 1. Edge Function `supabase/functions/sync-timers-and-protection/index.ts`

**Linha 253-254**: mudar threshold de finalização por inatividade

```
// DE:
// 4. SAFETY NET: Inatividade >= 30s — finalizar com bot
if (secondsSinceLastBid >= 30) {

// PARA:
// 4. SAFETY NET: Inatividade >= 45s — finalizar com bot
if (secondsSinceLastBid >= 45) {
```

## 2. Nova migration SQL

Recriar apenas o bloco de safety net do `bot_protection_loop`, alterando a linha 174 da migration anterior:

```sql
-- DE:
IF v_seconds_since_last_bid >= 40 THEN

-- PARA:
IF v_seconds_since_last_bid >= 60 THEN
```

O comentário associado muda de `>= 40s` para `>= 60s`. Restante da função permanece idêntico.

## 3. Frontend `src/hooks/useRealTimeProtection.ts`

**Linha 26**: reduzir polling

```typescript
// DE:
intervalRef.current = setInterval(callProtectionSystem, 10000);

// PARA:
intervalRef.current = setInterval(callProtectionSystem, 7000);
```

## Deploy

Deploy da edge function `sync-timers-and-protection` após a edição.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-timers-and-protection/index.ts` | `>= 30` → `>= 45` |
| Nova migration SQL | `bot_protection_loop` safety net `>= 40` → `>= 60` |
| `src/hooks/useRealTimeProtection.ts` | `10000` → `7000` |

