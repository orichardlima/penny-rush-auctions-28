## Diagnóstico

Os bots pararam porque nada está chamando a edge function que agenda os lances. Quando removi a lógica antiga de `bot_protection_loop()`, ela deixou de agendar bots — e a nova lógica (na edge function `sync-timers-and-protection`) só roda quando algo a chama. Verifiquei: não existe nenhum cron HTTP apontando para ela. Por isso `scheduled_bot_bid_at` está nulo em todos os leilões há ~4 min.

## Plano de correção

1. Criar 12 cron jobs HTTP que chamam `sync-timers-and-protection` a cada 5s (jobs com offset 0,5,10,…,55) usando o anon key. Isso devolve o agendamento.

2. Ajustar a função `selectBotBand` na edge para distribuir o alvo do lance naturalmente entre 2s e 13s restantes:
   - faixas com pesos: `late` (10–13s), `middle` (7–10s), `mid-low` (5–7s), `early` (3–5s), `rush` (2–3s);
   - jitter contínuo em ms;
   - anti-repetição da última banda.

3. Ativar PANIC apenas quando `time_left <= 1.5s` e não houver agendamento válido na janela. PANIC fica como exceção; humano-delay 100–500 ms.

4. Manter o executor de 1s (`bot-exec-*`) e a regra que bloqueia execução com `time_left <= 0` para não bidar depois do timer.

5. Validar:
   - bots voltam a bidar nos 3 leilões ativos;
   - distribuição cobre toda a janela 2–13s;
   - PANIC só aparece esporadicamente;
   - card não fica preso em “Verificando lances válidos”.

## Fora do escopo

Sem mudanças de UI, pagamentos, vencedor, finalização comercial ou RLS.