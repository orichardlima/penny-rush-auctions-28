

# Plano: Remover Toast "Conexão Instável"

## Mudança

Remover completamente a notificação visual de conexão instável, mantendo apenas:
- Polling de emergência (funcionalidade crítica)
- Logs no console para debug
- Lógica de reconexão automática

## Arquivo: src/contexts/AuctionRealtimeContext.tsx

### Remover

1. **Ref `lastToastTimeRef`** (linha 90) - não mais necessária
2. **Ref `disconnectToastTimeoutRef`** (linha 87) - não mais necessária  
3. **Bloco do setTimeout com toast** (linhas 436-459) - lógica de notificação
4. **Limpeza do timeout no cleanup** (linha 473) - referência removida
5. **Cancelamento do timeout na reconexão** (linhas 461-465) - não mais necessário

### Manter

- Polling de emergência a cada 5s quando desconectado
- Console.log para debug de desenvolvedores
- Lógica de reconexão automática do Supabase

### Código Final (bloco de status)

```typescript
if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
  console.log('⚠️ [REALTIME] Conexão perdida, ativando polling de emergência');
  
  // Ativar polling de emergência (silencioso para usuário)
  if (!emergencyPollRef.current) {
    emergencyPollRef.current = setInterval(() => {
      console.log('🆘 [REALTIME-CONTEXT] Polling de emergência');
      fetchAuctions();
    }, 5000);
  }
} else if (status === 'SUBSCRIBED') {
  console.log('✅ [REALTIME] Conexão restabelecida');
  
  // Desativar polling de emergência quando reconectar
  if (emergencyPollRef.current) {
    clearInterval(emergencyPollRef.current);
    emergencyPollRef.current = undefined;
  }
}
```

## Resultado

| Antes | Depois |
|-------|--------|
| Toast aparece após 10s | Nenhuma notificação |
| Cooldown de 60s | Silencioso sempre |
| Usuário vê "Conexão instável" | Experiência limpa |

A reconexão continua funcionando automaticamente em segundo plano.

