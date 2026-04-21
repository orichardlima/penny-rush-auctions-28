

## Verificação do sistema e correção residual

### Estado atual confirmado

**O que está funcionando corretamente:**
- `bot-protection-loop-00/30` e `execute-overdue-bot-bids-00/30` rodando a cada 30s no `pg_cron` (todos `active=true`)
- As funções `*_safe` já usam `pg_try_advisory_lock(8675309/8675310)` internamente, ou seja, mesmo se 2 execuções colidirem, a segunda sai sem fazer nada
- `useRealTimeProtection` está no-op (frontend não chama mais a cada 15s)
- Logs da edge function mostram execuções rápidas (200-700ms) sem timeouts

**Risco residual encontrado (1 ponto):**
`src/components/AuctionCard.tsx` linhas 109-142 ainda invoca `sync-timers-and-protection` via `supabase.functions.invoke()` quando o card entra em estado "Verificando":
- Dispara **5 chamadas em sequência, espaçadas de 2s**, por card
- Acontece sempre que um leilão chega ao timer 0 antes do backend finalizar
- Com N usuários assistindo M leilões simultaneamente em "Verificando", isso pode gerar `N × M × 5` chamadas em rajada — exatamente o tipo de pico que sobrecarregava o banco antes

Como o cron de 30s já cobre essa finalização (via `safety net` de inatividade ≥45s e via `execute_overdue_bot_bids`), essa chamada do card é **redundante** e perigosa.

### Correção proposta (1 arquivo, mudança mínima)

**Arquivo:** `src/components/AuctionCard.tsx`

Remover o bloco `useEffect` que dispara `sync-timers-and-protection` (linhas 108-142), mantendo apenas o `forceSync()` local (que apenas relê o leilão do banco, não invoca edge function).

Resultado: o card continua mostrando "Verificando" e re-sincronizando o estado quando o backend finalizar, mas para de empurrar a edge function. O cron nativo finaliza o leilão no próximo ciclo (≤30s), e o realtime já avisa todos os clientes.

### Verificações que ficam intactas

- Triggers `*_safe` com advisory lock — protegem contra qualquer execução concorrente futura
- Cron nativo a cada 30s (00s/30s) — única fonte de finalização e agendamento de bots
- Hook `useRealTimeProtection` — permanece no-op
- Edge function `sync-timers-and-protection` — continua existindo e pode ser chamada manualmente por admin se quiser, mas nenhum código do app a invoca mais
- Toda lógica de bots, vencedores, predefinidos, open_win_mode, fury vault, pagamentos e UI permanecem **idênticos**

### Resultado esperado após esta correção

- **Zero chamadas automáticas** à edge function `sync-timers-and-protection` vindas do frontend
- A função continua rodando apenas via os 2 cron jobs nativos do Postgres (~120 execuções/hora total, distribuídas)
- Sem possibilidade de retorno do problema de sobrecarga, mesmo com muitos usuários simultâneos e muitos leilões em "Verificando"
- Tempo de finalização visual: no pior caso, 30s (vs. instantâneo antes — mas o cron já estava cobrindo isso)

### Diagnóstico final

Com essa última remoção, o sistema fica 100% server-driven: o frontend só lê estado via realtime e a finalização é exclusivamente responsabilidade do cron nativo, que já tem dupla proteção (lock + idle 45s safety net). O problema **não pode voltar** porque não existe mais nenhum loop client-side que chame a edge function automaticamente.

