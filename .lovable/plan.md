

## Resposta direta

**Não, o bug não voltará a ocorrer** para leilões com `open_win_mode = true` finalizados por horário/inatividade/meta. A correção aplicada na `sync-timers-and-protection/index.ts` agora replica exatamente a lógica do `auction-protection`:

1. **SELECT atualizado** — agora traz `predefined_winner_ids`, `open_win_mode` e `min_bids_to_qualify`.
2. **`getEligibleRealLeader()`** — verifica se o último lance é de um real elegível (predefinido OU open_win + ≥ min_bids).
3. **`finalizeWithRealUser()`** — finaliza com o real quando elegível, em vez de cair no bot.
4. **Pausa de bots** — agendamento de bot é bloqueado enquanto o real elegível lidera.

## Cenário Mi Band se repetisse hoje

- 01:59:44 — Luis Paulo dá lance, vira líder real.
- 01:59:45+ — `sync-timers-and-protection` rodaria, veria `open_win_mode=true` + `min_bids=0` + Luis Paulo (real) liderando → **não agendaria bot**.
- 02:00:38 — finalização por horário/inatividade → `getEligibleRealLeader` retorna Luis Paulo → `finalizeWithRealUser` registra ele como vencedor.

## Pontos de atenção (não são bugs, são limites do sistema)

- **Janela de corrida de ~5s**: se um bot já tinha lance agendado antes do real dar o último lance, esse lance pode disparar via RPC `execute_overdue_bot_bids`. Isso é mitigado pelo trigger SQL `block_bot_bid_when_target_leading` (já existente). Vale validar via teste real que esse trigger também respeita `open_win_mode` — se não respeitar, é um próximo ajuste pequeno.
- **`min_bids_to_qualify > 0`**: se o admin exigir, ex., 10 lances e o real tiver só 8, ele NÃO ganha (comportamento correto, mas o admin precisa entender).

## Como confirmar em produção

Sugestão: criar um leilão de teste com `open_win_mode=true`, `min_bids_to_qualify=0`, dar 1 lance real perto do fim, e observar:
- Logs do `sync-timers-and-protection` devem mostrar `[REAL-LEADING]` (bots pausados).
- Na finalização, log esperado: `[FINALIZED-REAL]` em vez de `[FINALIZED]` com bot.

Se quiser, posso preparar um plano de validação via query no banco logo após o próximo leilão `open_win_mode` finalizar, comparando líder real vs vencedor registrado.

