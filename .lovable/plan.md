
# Plano: Sincronização de Timers via Timestamps Absolutos

## Problema Atual

O sistema atual usa **contadores locais independentes** em cada navegador:

```
Navegador A:  timer = 15 → 14 → 13 → [evento chega] → 15 → 14...
Navegador B:  timer = 15 → 14 → [evento chega 300ms depois] → 15 → 14...
                                 ↓
              Resultado: drift acumulativo de 1-5 segundos
```

Cada `setInterval` roda independente, e pequenas diferenças de latência se acumulam.

---

## Solução: Calcular Timer a partir de Timestamps

Ao invés de manter contadores locais, **calcular o tempo restante a partir de timestamps absolutos do servidor**:

```
deadline = last_bid_at + 15 segundos
tempo_restante = ceil(deadline - agora)
```

Todos os navegadores usam a mesma referência (`last_bid_at` do banco) e calculam o mesmo resultado.

---

## Mudanças Necessárias

### 1. Adicionar `last_bid_at` ao tipo `AuctionData`

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`

Adicionar o campo `last_bid_at` à interface:

```typescript
export interface AuctionData {
  // ... campos existentes ...
  last_bid_at: string | null;  // NOVO
}
```

### 2. Incluir `last_bid_at` na transformação de dados

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`

Na função `transformAuctionData`, incluir o campo:

```typescript
return {
  // ... campos existentes ...
  last_bid_at: auction.last_bid_at,  // NOVO
};
```

### 3. Substituir Map de timers por cálculo baseado em timestamp

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`

Remover o estado `timers` (Map) e o `setInterval` que decrementa. Substituir por uma função que calcula o tempo restante dinamicamente:

```typescript
// REMOVER:
const [timers, setTimers] = useState<Map<string, number>>(new Map());
const timerIntervalRef = useRef<NodeJS.Timeout>();

// useEffect com setInterval que decrementa timers

// ADICIONAR:
const calculateTimeLeft = useCallback((auction: AuctionData): number => {
  if (auction.auctionStatus !== 'active') return 0;
  
  const lastBidAt = auction.last_bid_at 
    ? new Date(auction.last_bid_at).getTime() 
    : Date.now();
  
  const deadline = lastBidAt + (15 * 1000); // 15 segundos após último lance
  const now = Date.now();
  const remaining = Math.ceil((deadline - now) / 1000);
  
  return Math.max(0, remaining);
}, []);

const getAuctionTimer = useCallback((auctionId: string) => {
  const auction = auctions.find(a => a.id === auctionId);
  if (!auction) return 0;
  return calculateTimeLeft(auction);
}, [auctions, calculateTimeLeft]);
```

### 4. Forçar re-render a cada segundo para atualizar display

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`

Manter um estado que muda a cada segundo apenas para forçar re-render:

```typescript
const [tick, setTick] = useState(0);

useEffect(() => {
  const interval = setInterval(() => {
    setTick(t => t + 1);
  }, 1000);
  
  return () => clearInterval(interval);
}, []);
```

### 5. Simplificar handlers de Realtime

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`

Remover toda a lógica de manipulação de timers nos handlers. O Realtime só precisa atualizar os dados do leilão (que incluem `last_bid_at`):

```typescript
// No handler de UPDATE:
// REMOVER: setTimers(...) 
// Apenas atualizar dados do leilão com updateAuction()

// No handler de INSERT em bids:
// REMOVER: setTimers(...)
// O UPDATE do auction já virá com last_bid_at atualizado
```

### 6. Fetch inteligente quando timer crítico

**Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`

Adicionar sync automático quando timer está baixo:

```typescript
useEffect(() => {
  const checkCriticalTimers = () => {
    const hasLowTimer = auctions.some(auction => {
      const timeLeft = calculateTimeLeft(auction);
      return timeLeft > 0 && timeLeft <= 3;
    });
    
    if (hasLowTimer) {
      fetchAuctions();
    }
  };
  
  const interval = setInterval(checkCriticalTimers, 3000);
  return () => clearInterval(interval);
}, [auctions, calculateTimeLeft, fetchAuctions]);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/AuctionRealtimeContext.tsx` | Refatorar sistema de timers para usar cálculo baseado em timestamp |

---

## Fluxo Corrigido

```
Lance dado pelo usuário
       │
       ▼
Trigger atualiza auctions.last_bid_at = now()
       │
       ▼
Realtime propaga UPDATE com last_bid_at
       │
       ├─────────────────────┬─────────────────────┐
       ▼                     ▼                     ▼
Navegador A              Navegador B          Navegador C
       │                     │                     │
       ▼                     ▼                     ▼
Recebe last_bid_at      Recebe last_bid_at    Recebe last_bid_at
= "2025-02-05 15:30:00" = "2025-02-05 15:30:00" = "2025-02-05 15:30:00"
       │                     │                     │
       ▼                     ▼                     ▼
Calcula:                Calcula:              Calcula:
deadline = 15:30:15     deadline = 15:30:15   deadline = 15:30:15
now = 15:30:02          now = 15:30:02        now = 15:30:02
timer = 13s             timer = 13s           timer = 13s
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                    SINCRONIZADOS!
```

---

## Comparação

| Aspecto | Sistema Atual | Novo Sistema |
|---------|---------------|--------------|
| Fonte de verdade | Cada navegador (local) | Banco de dados (`last_bid_at`) |
| Cálculo do timer | Decremento local com setInterval | `ceil(deadline - now)` |
| Drift entre navegadores | 1-5 segundos | Menos de 1 segundo |
| Custo por lance | 0 (mas dessincronizado) | 0 (usa dados do Realtime) |
| Sync ao voltar à aba | Fetch completo | Fetch completo |
| Sync quando timer baixo | Não | Sim (automático) |

---

## Benefícios

1. **Sincronização perfeita**: Todos os navegadores mostram o mesmo valor
2. **Zero SELECTs extras**: Usa apenas dados que já vêm no Realtime
3. **Resiliente a latência**: Calcula com base em timestamp absoluto
4. **Código mais simples**: Remove Map de timers e lógica de manipulação

---

## Considerações Técnicas

1. **Diferença de relógio**: Se o relógio do usuário estiver errado, haverá discrepância. Isso é raro e aceitável.

2. **Performance**: `calculateTimeLeft` é leve (apenas aritmética). Chamar a cada render é OK.

3. **Tick forçado**: O estado `tick` que incrementa a cada segundo força o Context a re-renderizar, atualizando os timers calculados.

4. **Fallback**: Se `last_bid_at` for null (leilão sem lances), usa `Date.now()` como referência.
