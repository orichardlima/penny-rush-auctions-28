

# Calibração: Polling 30s → 15s

## Mudança

**Arquivo:** `src/hooks/useRealTimeProtection.ts`

Linha 26: `setInterval(callProtectionSystem, 30000)` → `setInterval(callProtectionSystem, 15000)`

## Monitoramento pós-deploy (1-2h)

1. % inactivity_forced
2. Média de lances por leilão
3. Delay scheduled_bot_bid_at → execução
4. Tempo de execução da edge function (deve manter 100-300ms)
5. Estabilidade de auth e home

