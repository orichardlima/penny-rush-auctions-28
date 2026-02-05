
# Plano: Sincronização de Timers via Timestamps Absolutos

## Objetivo
Implementar sistema de timers baseado em timestamps absolutos com helper puro, throttle adaptativo e proteção contra state stale.

## Arquivos a Modificar

### 1. src/contexts/AuctionRealtimeContext.tsx

**Mudanças:**

1. **Atualizar interface de retorno:**
```typescript
interface AuctionTimerResult {
  timeLeft: number;
  isSyncing: boolean;
}

interface AuctionRealtimeContextType {
  auctions: AuctionData[];
  isConnected: boolean;
  loading: boolean;
  getAuctionTimer: (auctionId: string) => AuctionTimerResult;
  forceSync: () => Promise<void>;
}
```

2. **Adicionar helper puro para cálculo de timer:**
```typescript
const calculateTimeLeftFromFields = (
  status: string,
  lastBidAt: string | null,
  endsAt: string | null
): number => {
  if (status !== 'active') return 0;
  if (!lastBidAt) return -1; // Precisa sync
  
  const lastBidTime = new Date(lastBidAt).getTime();
  const bidDeadline = lastBidTime + (15 * 1000);
  
  let deadline = bidDeadline;
  if (endsAt) {
    deadline = Math.min(bidDeadline, new Date(endsAt).getTime());
  }
  
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
};
```

3. **Adicionar ref para throttling e função fetchSingleAuction**

4. **Refatorar checkCriticalTimers para filtrar apenas leilões ativos**

5. **Atualizar handler UPDATE para usar helper com payload.new**

6. **Atualizar getAuctionTimer para retornar {timeLeft, isSyncing}**

### 2. src/components/AuctionCard.tsx

**Mudanças:**

1. **Destructuring do getAuctionTimer:**
```typescript
const { timeLeft: contextTimer, isSyncing } = getAuctionTimer(id);
```

2. **Adicionar UI "Sincronizando..." quando isSyncing = true**

## Benefícios
- Sem duplicação de lógica (helper único)
- Sem race condition (usa payload.new, não state)
- Menos iterações (só processa leilões ativos)
- Fetch inteligente (por ID com throttle 2s/5s)
- UI resiliente (flag isSyncing previne "-1s")
