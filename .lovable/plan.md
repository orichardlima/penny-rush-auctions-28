## Problema

Bots demoram 15-17s entre lances, ultrapassando a janela de 15s e fazendo o card piscar "Verificando lances válidos" constantemente. Confirmado nos logs (gaps de 15,69s e 16,02s em sequência).

## Causa raiz

Duas latências somadas:
1. **Tick a cada 10s** (cron `bot-tick-00…50`): qualquer `scheduled_bot_bid_at` espera até 10s para ser executado.
2. **Bandas de delay vão até 14s** (`sniper` 13-14s, `late` 10-12s), com regra de agendar só após `secondsSinceLastBid >= 5`.

Fluxo: lance em T=0 → tick T≈5-10s agenda com delay 2-14s → tick seguinte T≈15-20s executa. Bot bida quase sempre entre T+15s e T+20s.

## Solução

Duas mudanças coordenadas, ambas focadas em garantir bid antes de T=15s sem mexer no comportamento "natural" dos bots (continuam variando timing).

### 1. Aumentar frequência do tick para 5 segundos
Adicionar 6 cron jobs intermediários (`bot-tick-05`, `15`, `25`, `35`, `45`, `55`) que chamam `bot_tick_safe()` com `pg_sleep` de 5/15/25/35/45/55 segundos. Cobre todos os 5 segundos do minuto. Reduz latência máxima do execute de 10s para 5s.

### 2. Reduzir teto das bandas de delay
Em `supabase/functions/sync-timers-and-protection/index.ts`, ajustar `selectBotBand`:
- `early`: 2-4s (mantém)
- `middle`: 5-7s (era 6-9s)
- `late`: 8-10s (era 10-12s)
- remover banda `sniper` (13-14s)

Distribuição nova: 25% early / 45% middle / 30% late. Mantém variedade de timing percebida, mas garante target ≤ T+10s. Somado ao tick de 5s, o bot bida no máximo em T+15s real.

### 3. Reduzir janela mínima para agendar
Mudar `if (secondsSinceLastBid >= 5)` para `if (secondsSinceLastBid >= 2)`. Permite agendar mais cedo, dando folga para o próximo tick executar dentro da janela.

## Validação

Após deploy, observar por ~5 minutos:
- Logs do `sync-timers-and-protection`: campo `bot_bids_executed` por tick.
- Query no banco: `SELECT auction_id, EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY auction_id ORDER BY created_at))) FROM bids WHERE created_at > now() - interval '5 minutes'` — todos os gaps consecutivos devem ficar ≤ 14s.
- UI: card não deve mais mostrar "Verificando lances válidos" durante leilões ativos saudáveis.

## Detalhes técnicos

**Arquivos alterados**:
- `supabase/functions/sync-timers-and-protection/index.ts` — ajustar `selectBotBand` e o threshold de scheduling.
- Migração SQL — `cron.schedule` para 6 novos jobs (`bot-tick-05/15/25/35/45/55`) usando `bot_tick_safe()` com `pg_sleep` apropriado.

**Sem impacto em**:
- Lógica de finalização (`finalize`, `getEligibleRealLeader`, predefined_winner, open_win_mode).
- Receita, fury vault, ordens, qualquer outro fluxo.
- UI/UX dos leilões (somente reduz o flicker de "Verificando").

**Custo**: dobra o número de invocações da edge `sync-timers-and-protection` (de ~6/min para ~12/min). Cada execução é leve (~200-400ms), aceitável para o plano Supabase atual.

**Rollback**: simples — remover os novos cron jobs e reverter o arquivo da edge function.
