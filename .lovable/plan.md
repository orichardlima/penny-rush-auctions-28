## Diagnóstico

O timer está zerando novamente porque existem dois caminhos ativos controlando bots:

1. `bot-exec-*` a cada 1s executa apenas `execute_overdue_bot_bids()`.
2. `bot-tick-*` a cada 5s chama `bot_tick_safe()`, que chama `bot_tick()`, que por sua vez chama `bot_protection_loop()`.

O problema é que `bot_protection_loop()` ainda tem uma lógica antiga própria:

- Agenda lances com delay fixo de 2s–8s.
- Tem `PANIC_BID` a partir de 6s restantes.
- Usa ticks de 5s.
- Pode sobrescrever/competir com a nova lógica da edge function.

Além disso, observei dados reais com lances de bot acontecendo depois de 15s desde o lance anterior, causando exatamente o estado “Verificando lances válidos”.

## Plano de correção

1. Alterar a função SQL `bot_tick()` para parar de chamar `bot_protection_loop()`.
   - Ela passará a executar somente `execute_overdue_bot_bids()`.
   - Isso mantém os jobs antigos `bot-tick-*` como executor extra, mas impede que eles usem a lógica antiga de agendamento/panic.

2. Manter a edge function `sync-timers-and-protection` como única responsável por:
   - ativar leilões;
   - finalizar leilões;
   - agendar o próximo bot pelo modelo novo;
   - aplicar `PANIC` apenas como exceção.

3. Ajustar a janela do agendamento novo para reduzir risco de zeragem:
   - manter distribuição por `time_left`, mas limitar alvo normal para no mínimo 4s restantes em vez de 3s;
   - isso mantém variação natural e dá margem real para executor de 1s + latência Supabase;
   - `PANIC` continua reservado para `time_left <= 2` sem agendamento válido.

4. Melhorar logs de execução no SQL `execute_overdue_bot_bids()`.
   - Registrar por lance executado:
     - `scheduled_delay_after_last_bid`;
     - `scheduled_target_time`;
     - `actual_execution_time`;
     - `time_left_at_execution`;
     - `path` (`NORMAL` ou `PANIC`);
     - `band`.

5. Validar no banco após a alteração:
   - sem lances executados depois de 15s;
   - concentração em 6s continua baixa;
   - `PANIC` não vira padrão;
   - cards ativos não ficam sem agendamento enquanto o timer está crítico;
   - cron jobs permanecem ativos/Healthy.

## Fora do escopo

- Não alterar UI.
- Não alterar pagamentos, vencedor, finalização comercial, RLS ou fluxo de usuários.
- Não mexer em PIX/VeoPag.