
# Plano: Reduzir Toasts "Conexão Instável" em Mobile

## Problema
A mensagem aparece frequentemente em celulares porque:
- Timeout de 5s é curto para oscilações de rede móvel
- Não há cooldown entre toasts consecutivos
- Redes móveis oscilam naturalmente entre 3G/4G/5G/Wi-Fi

## Mudanças em src/contexts/AuctionRealtimeContext.tsx

### 1. Adicionar ref para controlar cooldown
```typescript
const lastToastTimeRef = useRef<number>(0);
```

### 2. Aumentar timeout e adicionar cooldown (linhas 436-446)
**Antes:**
```typescript
disconnectToastTimeoutRef.current = setTimeout(() => {
  toast({
    title: "Conexão instável",
    description: "Reconectando automaticamente...",
    variant: "default",
  });
  disconnectToastTimeoutRef.current = undefined;
}, 5000);
```

**Depois:**
```typescript
disconnectToastTimeoutRef.current = setTimeout(() => {
  const now = Date.now();
  const timeSinceLastToast = now - lastToastTimeRef.current;
  
  // Cooldown de 60 segundos entre toasts
  if (timeSinceLastToast > 60000) {
    lastToastTimeRef.current = now;
    toast({
      title: "Conexão instável",
      description: "Reconectando automaticamente...",
      variant: "default",
    });
  } else {
    console.log('🔇 [REALTIME] Toast suprimido (cooldown 60s)');
  }
  
  disconnectToastTimeoutRef.current = undefined;
}, 10000); // Aumentado de 5s para 10s
```

## Resultado

| Configuração | Antes | Depois |
|--------------|-------|--------|
| Tempo antes do toast | 5s | 10s |
| Cooldown entre toasts | 0s | 60s |
| Comportamento em oscilação | Toast aparece | Silencioso |

## Benefícios
- Menos interrupções visuais no celular
- Maioria das oscilações se resolve em <10s (silencioso)
- Se realmente há problema de conexão, toast aparece 1x por minuto (máximo)
