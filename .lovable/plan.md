Objetivo: eliminar o padrão mecânico do bot entrar quase sempre com 6s restantes, trazendo naturalidade real (lances entrando com 3s, 5s, 8s, 10s, 12s restantes), sem risco do timer zerar e sem "Verificando lances válidos".

Escopo restrito: apenas o motor de timing dos bots. Nada de UI, pagamentos, parceiros, vencedor, finalização, fury vault, RLS ou regras de negócio.

## 1. Executor a cada 1 segundo

Hoje existem 12 cron jobs `bot-tick-XX` rodando o executor a cada 5s. Vou:

- Criar uma função SQL leve `tick_bot_executor()` que apenas chama `execute_overdue_bot_bids()` (sem HTTP, sem agendamento — só execução do que já está vencido).
- Substituir os 12 jobs HTTP atuais por 60 jobs pg_cron (`bot-exec-00` a `bot-exec-59`) que chamam `tick_bot_executor()` direto via SQL — um por segundo do minuto. Sem `pg_net`, sem latência de HTTP.
- Manter os jobs atuais que disparam `sync-timers-and-protection` (agendamento/finalização) com a frequência atual de 5s — eles continuam responsáveis por agendar novos lances, finalizar leilões e safety net.

Resultado: o lance agendado entra com precisão de ~1s, permitindo distribuir o alvo por toda a janela do timer sem risco de cair depois do zero.

## 2. Sortear pelo time_left, não pelo delay após last_bid_at

Reescrever `selectBotBand` em `supabase/functions/sync-timers-and-protection/index.ts` para sortear o **tempo restante alvo do timer** (não o delay desde o último lance):

- 20% → entrar com 11–13s restantes (delay 2–4s)
- 20% → entrar com 8–10s restantes (delay 5–7s)
- 25% → entrar com 5–7s restantes (delay 8–10s)
- 20% → entrar com 3–4s restantes (delay 11–12s)
- 15% → entrar com 7–9s restantes (faixa intermediária extra)

Tudo em milissegundos contínuos com jitter, nunca segundos redondos.

Limite mínimo de segurança rígido: **alvo nunca menor que 3s restantes** (delay máximo = 12s). Isso garante margem de 3s + precisão de 1s do executor = nunca cai depois do zero.

Anti-repetição: não repetir a mesma faixa do último lance (usa `last_bot_band` já existente).

## 3. PANIC_BID só como exceção

- Disparar somente se `time_left ≤ 2` E não houver agendamento válido dentro da janela.
- Atraso humano 200–800ms.
- Logar com `path=PANIC` para auditoria.
- Não pode virar caminho dominante — se aparecer em mais de ~5% das execuções, é sinal de bug.

## 4. Corrigir invalidação prematura

Manter o check atual (`scheduledAtMs > lastBidTime + 14000` → fora da janela) que já protege agendamentos longos. Garantir que o agendamento normal nunca seja descartado pelo PANIC enquanto estiver dentro da janela de 15s.

## 5. Logs estruturados

Em todo agendamento e execução, registrar JSON com:

```
auction_id, title, path (NORMAL|PANIC), band,
scheduled_delay_after_last_bid, scheduled_target_time,
actual_execution_time, time_left_at_execution
```

- Agendamento loga no `sync-timers-and-protection`.
- Execução loga dentro de `execute_overdue_bot_bids()` via `RAISE NOTICE` capturado nos logs Postgres, ou retornar o array de execuções e logar no edge function que invocou.

## 6. Arquivos alterados

- `supabase/functions/sync-timers-and-protection/index.ts` — nova `selectBotBand` (sorteio por time_left), PANIC só ≤2s, logs estruturados.
- Migration: criar `tick_bot_executor()` + 60 jobs pg_cron de 1s + remover/desativar os 12 jobs HTTP de 5s do executor (manter os de agendamento).
- Opcional: ajustar `execute_overdue_bot_bids()` para retornar/logar `actual_execution_time` e `time_left_at_execution` por lance executado.

## 7. Validação após deploy

Esperar ~60s de atividade real e rodar:

```sql
select scheduled_band,
       round(avg(extract(epoch from (b.created_at - a.last_bid_at_prev)))::numeric, 2) as avg_delay,
       count(*) as n
from bids b join ... group by scheduled_band;
```

Critérios de aceite:

- Distribuição visível em todas as faixas (rush/early/middle/late), nenhuma concentrando >35%.
- `time_left_at_execution` distribuído entre ~3s e ~13s, não colado em 5–6s.
- `path=PANIC` em ≤5% das execuções.
- Nenhum card mostrando "Verificando lances válidos" durante disputa normal.
- Nenhum `actual_execution_time` posterior a `last_bid_at + 15s`.
- Supabase Healthy (sem picos de erro nos logs Postgres/edge).