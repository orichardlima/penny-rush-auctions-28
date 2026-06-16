# Painel de Monitoramento de Bots e Cron Jobs

Nova aba no Painel Administrativo ("Monitor Bots") com 3 seções em tempo real para acompanhar a saúde do sistema de lances automatizados.

## O que será exibido

### 1. Status dos Cron Jobs
Card no topo mostrando os 12 jobs `sync-timers-protection-XX`:
- Nome do job, agendamento (`* * * * *`), última execução
- Status da última run (success/failed) com badge colorido
- Duração e mensagem de retorno
- Indicador geral verde/vermelho ("Sistema saudável" / "Atenção")
- Botão "Disparar agora" (invoca `sync-timers-and-protection` manualmente)

### 2. Leilões Ativos — Timing dos Bots
Tabela live (atualiza a cada 2s via realtime + polling) com uma linha por leilão ativo:
- Título do leilão
- `time_left` atual (countdown visual)
- `last_bid_at` + segundos desde último lance
- `scheduled_bot_band` (early / mid-low / middle / late / rush / PANIC)
- `scheduled_bot_bid_at` (horário previsto do próximo lance bot) + countdown
- Estado: "Aguardando bot", "PANIC armado", "Pausado (vencedor real)", "Open-win ativo"
- Último bot que deu lance (nome)

### 3. Logs de Execução por Leilão
Painel inferior com:
- Seletor de leilão (dropdown dos ativos + busca por ID)
- Stream dos últimos 50 lances (`bids` filtrada) com timestamp, bot/real, valor, band usada
- Eventos de `bot_webhook_logs` recentes
- Histórico de bandas escolhidas (mostra distribuição visual 2–13s)
- Auto-scroll com pausa ao hover

## Detalhes técnicos

**Arquivos novos:**
- `src/components/Admin/BotMonitorDashboard.tsx` — componente principal
- `src/components/Admin/BotMonitor/CronJobsStatus.tsx`
- `src/components/Admin/BotMonitor/ActiveAuctionsTiming.tsx`
- `src/components/Admin/BotMonitor/AuctionBotLogs.tsx`
- `src/hooks/useBotMonitor.ts` — agrega queries e realtime
- `supabase/functions/admin-bot-monitor/index.ts` — edge function que retorna estado dos cron jobs (lê `cron.job` + `cron.job_run_details` via service role, restrito a admins)

**Arquivos editados:**
- `src/components/AdminDashboard.tsx` — adicionar `TabsTrigger` "Monitor Bots" (ícone `Gauge`) e `TabsContent` correspondente

**Fontes de dados:**
- Cron: edge function `admin-bot-monitor` consultando `cron.job` e `cron.job_run_details` (últimas 20 runs por job)
- Leilões: query em `auctions` (status='active') com colunas `scheduled_bot_band`, `scheduled_bot_bid_at`, `last_bid_at`, `time_left`, `predefined_winner_id`, `open_win_*`
- Realtime: subscribe em `auctions` (UPDATE) e `bids` (INSERT) com cleanup adequado em `useEffect`
- Logs: `bids` (últimos N por `auction_id`) + `bot_webhook_logs`

**Sem migrações de schema.** Apenas uma edge function read-only com verificação `is_admin`. Sem alterações no comportamento dos bots, sem mudanças em UI/funcionalidades existentes — apenas adição de uma nova aba.

## Fora do escopo
- Editar parâmetros de bots pelo painel (apenas leitura/observabilidade)
- Alertas por email/push
- Histórico persistido de longo prazo (usa apenas dados atuais do banco)

Confirma que posso seguir com essa estrutura?
