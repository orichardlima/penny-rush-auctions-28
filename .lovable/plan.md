

# Plano de Otimizacao do Realtime - Reducao de 80-90%

## Resumo

Este plano elimina canais Realtime duplicados, cron jobs desnecessarios e listeners redundantes, mantendo a experiencia do usuario 100% intacta. O timer, os lances e os bots continuarao funcionando em tempo real e simultaneamente para todos os usuarios.

## O que o usuario continua vendo (sem mudanca)

- Timer contando em tempo real para todos simultaneamente
- Lances aparecendo instantaneamente
- Bots atuando normalmente via cron `sync-timers-and-protection`
- Notificacoes de novos leiloes e leiloes terminando
- Dashboard financeiro admin atualizado (com no maximo 30s de atraso)
- Dashboard de parceiros atualizado

## Mudancas (6 itens)

### 1. Desativar cron `timer-protection` (Job 41) - DUPLICADO

O cron Job 41 chama a edge function `timer-protection` a cada 5 segundos, mas essa edge function **nao existe** no codigo do projeto. A chamada provavelmente retorna 404 a cada execucao. O Job 42 (`sync-timers-and-protection`) ja cobre toda a logica de protecao e bots.

- **Acao:** Executar SQL: `SELECT cron.unschedule(41);`
- **Impacto no usuario:** Nenhum

### 2. Desativar cron `timer-decrement` (Job 43)

Este cron roda a cada 1 minuto e faz UPDATE em `auctions.time_left` para cada leilao ativo. Cada UPDATE gera broadcast Realtime para todos os clientes. Porem, o frontend **ja calcula o timer localmente** usando `last_bid_at + 15s` (funcao `calculateTimeLeftFromFields` no `AuctionRealtimeContext.tsx`). O campo `time_left` e sobrescrito pelo trigger `update_auction_on_bid` a cada lance.

- **Acao:** Executar SQL: `SELECT cron.unschedule(43);`
- **Impacto no usuario:** Nenhum. O timer ja e calculado localmente.
- **Economia:** ~17.280 UPDATEs fantasma/dia eliminados (12 leiloes x 1440 minutos)

### 3. Remover listener de INSERT em `bids` do canal global

No `AuctionRealtimeContext.tsx`, o canal `global-auctions-channel` escuta tanto UPDATEs em `auctions` quanto INSERTs em `bids`. Quando um lance e inserido, o trigger `update_auction_on_bid` ja faz UPDATE em `auctions` automaticamente. Entao cada lance gera **2 eventos** no canal. O handler de UPDATE em auctions ja chama `fetchRecentBidders()` para atualizar a lista de nomes.

- **Arquivo:** `src/contexts/AuctionRealtimeContext.tsx`
- **Acao:** Remover o bloco `.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids' }, ...)` (linhas 423-428)
- **Impacto no usuario:** Nenhum. A lista de bidders recentes continua atualizada pelo handler de UPDATE.
- **Economia:** 50% menos mensagens no canal principal

### 4. Substituir canal `financial-analytics` por polling de 30s

O hook `useFinancialAnalytics.ts` cria um canal Realtime que escuta **5 tabelas** (`auctions`, `bids`, `bid_purchases`, `profiles`, `bid_packages`) com `event: '*'`. E usado apenas no dashboard administrativo. Cada lance de bot dispara refresh de 3 queries pesadas.

- **Arquivo:** `src/hooks/useFinancialAnalytics.ts`
- **Acao:** Remover o canal Realtime (linhas 174-215) e substituir por `setInterval` de 30 segundos. Manter o botao de refresh manual.
- **Impacto no usuario:** Dashboard admin atualiza a cada 30s em vez de instantaneo. Perfeitamente aceitavel para dados analiticos/financeiros.
- **Economia:** Elimina 5 subscriptions por admin conectado

### 5. Deletar hook legado `useAuctionRealtime.ts`

O arquivo `src/hooks/useAuctionRealtime.ts` cria um canal `auction-updates` que escuta `event: '*'` em `auctions`. **Nenhum componente importa este hook** (confirmado por busca no codigo). Toda a funcionalidade foi centralizada no `AuctionRealtimeContext.tsx`. E codigo morto que pode causar confusao.

- **Arquivo:** `src/hooks/useAuctionRealtime.ts`
- **Acao:** Deletar o arquivo
- **Impacto no usuario:** Nenhum. Nenhum componente usa este hook.

### 6. Consolidar notificacoes no canal central

O hook `useNotifications.ts` cria 2 canais separados (`auction-ending-notifications` e `new-auction-notifications`) que escutam as mesmas tabelas que o canal principal. As notificacoes de "novo leilao" ja sao tratadas no `AuctionRealtimeContext.tsx` (toast no handler de INSERT em auctions). A notificacao de "terminando em breve" pode verificar o timer local calculado.

- **Arquivo:** `src/hooks/useNotifications.ts`
- **Acao:** Remover os 2 canais Realtime. Manter as configuracoes de toggle e localStorage. A notificacao de "novo leilao" ja existe no Context. Para "leilao terminando", adicionar verificacao no tick de 1 segundo do Context (verificar `timeLeft <= 30` usando o calculo local).
- **Impacto no usuario:** Nenhum. Mesmas notificacoes, mesmos toggles na tela de configuracoes.
- **Economia:** Elimina 2 canais por usuario logado

### Bonus: Canal `current-week-revenue`

O hook `useCurrentWeekRevenue.ts` ja tem polling de 15 segundos **e** um canal Realtime na tabela `daily_revenue_config`. Como essa tabela so muda quando o admin configura manualmente (raramente), o canal pode ser removido e o polling de 15s ja cobre a necessidade.

- **Arquivo:** `src/hooks/useCurrentWeekRevenue.ts`
- **Acao:** Remover o canal Realtime `current-week-revenue` (linhas 151-160). Manter o polling de 15s.
- **Impacto no usuario:** Nenhum. O polling de 15s ja atualiza os dados.

## Resultado final

```text
ANTES (por cliente conectado):
  7 canais Realtime simultaneos
  ~13 subscriptions de tabela
  2 mensagens por lance no canal principal
  + 17.280 UPDATEs fantasma/dia do timer-decrement
  + 17.280 chamadas 404/dia do timer-protection

DEPOIS (por cliente conectado):
  1 canal Realtime (global-auctions-channel)
  2 subscriptions (UPDATE auctions + INSERT auctions)
  1 mensagem por lance
  0 UPDATEs fantasma
  0 chamadas 404

Reducao estimada: ~85-90% das mensagens Realtime
```

## Detalhes tecnicos

### Arquivos modificados:
1. `src/contexts/AuctionRealtimeContext.tsx` - Remover listener INSERT bids (linhas 423-428). Adicionar logica de notificacao "leilao terminando" no tick de 1 segundo.
2. `src/hooks/useFinancialAnalytics.ts` - Substituir canal Realtime por setInterval de 30s.
3. `src/hooks/useNotifications.ts` - Remover os 2 canais Realtime. Manter settings/updateSettings/localStorage.
4. `src/hooks/useCurrentWeekRevenue.ts` - Remover canal Realtime (manter polling 15s).

### Arquivo deletado:
5. `src/hooks/useAuctionRealtime.ts` - Codigo morto sem importacoes.

### SQL a executar:
6. `SELECT cron.unschedule(41);` - Desativar timer-protection duplicado
7. `SELECT cron.unschedule(43);` - Desativar timer-decrement desnecessario

### Arquivos NAO modificados (garantia de preservacao):
- `supabase/functions/sync-timers-and-protection/index.ts` - Bots e protecao intactos
- `supabase/functions/auction-protection/index.ts` - Logica de protecao intacta
- `AuctionCard.tsx`, `Index.tsx`, `Auctions.tsx` - Interface do usuario intacta
- `src/components/NotificationSettings.tsx` - Tela de configuracoes intacta (continua usando useNotifications)
- Todos os componentes de UI - Nenhuma mudanca visual

