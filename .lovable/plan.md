

## Diagnóstico — por que Richard ganhou e Luis Paulo não

### Por que Richard Lima (PS5) ganhou
O leilão do PS5 tinha **Richard no `predefined_winner_ids`**. Tanto o `sync-timers-and-protection` quanto o trigger antigo `block_bot_bid_when_target_leading` já reconheciam `predefined_winner_id(s)` há semanas. Quando o tempo limite chegou, a função `finalize()` viu que o predefinido liderava e chamou `finalizeWithPredefinedWinner`. Funcionou.

### Por que Luis Paulo (Mi Band) NÃO ganhou
Apesar do `open_win_mode = true` e ele ter dado o último lance às 01:59:44, o leilão foi finalizado às 02:00:38 com a bot Benedita Lima. **Causa raiz**: a edge function `sync-timers-and-protection/index.ts` (que é quem efetivamente finaliza leilões por horário/meta/inatividade) **NÃO foi atualizada** para entender `open_win_mode` / `min_bids_to_qualify`. Apenas o `auction-protection` e o trigger SQL foram. A função `finalize()` lá dentro só verifica `predefined_winner_id` (singular, legado) — se o líder não está nessa lista, ela cai direto em `finalizeWithBot()`, ignorando completamente o líder real elegível pelo modo aberto.

Ou seja: o `open_win_mode` bloqueia bots de **darem lance** (via trigger), mas no momento da **finalização** por inatividade/horário, o `sync-timers-and-protection` ignora a regra e premia um bot aleatório.

### Bugs adicionais detectados no mesmo arquivo
1. `isPredefinedWinnerLeading` lê só `predefined_winner_id` (singular legado), ignora `predefined_winner_ids[]` — pode quebrar a regra antiga em leilões novos que usem só o array.
2. O SELECT da linha 280 não traz `predefined_winner_ids`, `open_win_mode` nem `min_bids_to_qualify`.

## Correção proposta

Atualizar **somente** `supabase/functions/sync-timers-and-protection/index.ts`:

1. Incluir `predefined_winner_ids, open_win_mode, min_bids_to_qualify` no SELECT de leilões ativos (linha ~280).
2. Substituir `isPredefinedWinnerLeading` por `getEligibleRealLeader(auction)` — mesma lógica já existente no `auction-protection`:
   - Pega o último lance.
   - Elegível se: (a) está em `predefined_winner_ids` (ou no legado), OU (b) `open_win_mode=true` + `is_bot=false` + lances ≥ `min_bids_to_qualify`.
3. Adicionar `finalizeWithRealUser(userId, ...)` (espelhando o `auction-protection`).
4. Refatorar a `finalize()` interna: se houver líder elegível → `finalizeWithRealUser`; senão → `finalizeWithBot`.
5. No bloco "pular agendamento se alvo lidera" (linha 361), trocar por checagem do `getEligibleRealLeader` para também pausar agendamento de bots quando real elegível (open_win) liderar.

### Fora de escopo (não mexer)
- UI, fluxo de pagamento, orders, timer, demais edge functions.
- Trigger SQL (já correto).
- Lógica de `predefined_winner_ids` continua intacta.

### Resultado esperado
Cenário Mi Band se repetiria assim: às 02:00:38 (horário/inatividade), `sync-timers-and-protection` veria Luis Paulo como líder + `open_win_mode=true` + `min_bids=0` → finalizaria com Luis Paulo como vencedor real, não com a bot Benedita.

