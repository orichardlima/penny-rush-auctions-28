
# Motor de Bots com Timing Natural por Agendamento

## 1. Migration SQL

### 1a. Adicionar 3 colunas à tabela `auctions`
- `scheduled_bot_bid_at` (timestamptz, default NULL)
- `scheduled_bot_band` (text, default NULL)
- `last_bot_band` (text, default NULL)

### 1b. Modificar trigger `update_auction_on_bid()`
Adicionar ao UPDATE existente:
- `scheduled_bot_bid_at = NULL`
- `scheduled_bot_band = NULL`
Todo novo lance invalida o agendamento pendente.

### 1c. Recriar `bot_protection_loop` com lógica de agendamento
- Finalizações (time_limit, max_price, revenue_target) inalteradas
- Inatividade >= 40s: finalizar com bot (safety net)
- Executar agendamento vencido: se `scheduled_bot_bid_at IS NOT NULL AND now() >= scheduled_bot_bid_at AND scheduled_bot_bid_at >= last_bid_at AND status = 'active'`
- Agendar novo lance: se `scheduled_bot_bid_at IS NULL AND inatividade >= 5s`
- Faixas: early (2-5s, 20%), middle (6-9s, 40%), late (10-12s, 30%), sniper (13-14s, 10%)

## 2. Edge Function `sync-timers-and-protection/index.ts`
- Adicionar `scheduled_bot_bid_at, scheduled_bot_band, last_bot_band` ao SELECT
- Subir inatividade forçada de 12s para 30s
- Substituir lance probabilístico por:
  - Fase A: executar agendamento vencido (com validação de ciclo)
  - Fase B: agendar novo lance (com anti-repetição)

## 3. Deploy da edge function

## Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| Nova migration SQL | 3 colunas + trigger + bot_protection_loop |
| `supabase/functions/sync-timers-and-protection/index.ts` | Lógica agendar/executar |
