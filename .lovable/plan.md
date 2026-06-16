## Objetivo

Garantir que o card **nunca** mostre "Verificando lances válidos" durante a disputa normal — só no encerramento real. O lance do bot precisa cair **antes** do timer de 15s zerar, com margem ≥ 2s.

## Causa raiz

- Faixas de delay atuais vão até 14s (banda `sniper`), com `bot_protection_loop` e `selectBotBand` (edge function) usando 5–14s e 2–10s respectivamente.
- Ticks de execução rodam a cada 5s. Pior caso: `delay = 14s` + 5s de espera do tick = lance em `last_bid + 19s`, com timer já em zero por 4s.

## Mudanças (somente motor de bots)

### 1. SQL — `public.bot_protection_loop()`

Atualizar via **migração** o bloco de seleção de banda (linhas 99–107 da migração `20260421173211...`) e o gate mínimo:

- early: 2–4s (40%)
- middle: 4–6s (35%)
- late: 6–8s (25%)
- **remover** a banda `sniper` (14s)
- gate: `v_seconds_since_last_bid >= 2` (era `>= 5`)
- ajustar o fallback de anti-repetição (linhas 110–113) para manter valores ≤ 8s
- **Regra de segurança extra (panic bid)**: antes do bloco de agendamento, se o leilão estiver ativo, sem agendamento pendente (ou com agendamento que cairia depois de `last_bid + 13s`), e `time_left_calc = 15 - v_seconds_since_last_bid <= 6`, executar lance **imediatamente** (mesma rotina que `execute_overdue_bot_bids` usa para inserir um bid + atualizar `last_bid_at`), sem agendar. Isso garante que mesmo se um tick anterior falhar ou houver atraso, o card nunca aparece como "Verificando" durante a disputa.

### 2. Edge function `sync-timers-and-protection`

Atualizar `selectBotBand()` para as mesmas faixas (2–4 / 4–6 / 6–8) e remover qualquer caminho com delay > 8s. Manter `secondsSinceLastBid >= 2` que já existe na fase 7.

Adicionar a mesma **regra de panic bid** na Fase 3 do `Deno.serve`: para cada leilão ativo, antes do `continue` que ignora quando `scheduled_bot_bid_at` existe, calcular `timeLeft = 15 - secondsSinceLastBid`. Se `timeLeft <= 6` e não há líder real elegível (predefined/open_win), forçar execução imediata via `execute_overdue_bot_bids` (já é atômico) ou limpar `scheduled_bot_bid_at` e reagendar para `now()`.

### Pior caso após mudanças

- Agendamento normal: alvo ≤ `last_bid + 8s`, tick em até 5s ⇒ execução ≤ `last_bid + 13s` (margem 2s antes do timer expirar).
- Caminho `panic bid`: executa instantaneamente quando `timeLeft <= 6s`, eliminando qualquer chance de chegar a 0s.

## Validação (≥ 30 min em 3–5 leilões)

1. Logs `[BOT-SCHED]` e `[BOT-EXEC]` com `delay_sec ≤ 8` em 100% dos casos.
2. Logs do panic bid (vou adicionar `RAISE LOG '⚠️ [PANIC-BID]'`) só disparam em situações de borda, não em fluxo padrão.
3. Inspeção visual: nenhum leilão exibe "Verificando lances válidos" durante a disputa.
4. `supabase--slow_queries` antes/depois para confirmar que `bids` e `bot_protection_loop` continuam estáveis.
5. Saúde do projeto Supabase Healthy.

## Fora de escopo

UI, finalização, fury vault, vencedor predefinido/open_win, pagamentos, parceiros, RLS, regras externas. Apenas motor de agendamento e execução de bots.
