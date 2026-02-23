

# Corrigir cron do sync-timers-and-protection (5min para 1min)

## Problema
O cron job `sync-timers-and-protection` esta rodando a cada 5 minutos (`*/5 * * * *`). Quando o bot da um lance e reseta o timer para 15 segundos, apos esses 15s o timer zera e a UI mostra "Verificando lances validos" por ate ~4 minutos e 45 segundos ate o proximo ciclo do cron.

## Solucao
Atualizar o schedule do cron job existente (jobid: 42) de `*/5 * * * *` para `* * * * *` (a cada 1 minuto).

## Mudanca necessaria

Uma unica operacao SQL no banco de dados:

```text
UPDATE cron.job SET schedule = '* * * * *' WHERE jobid = 42;
```

## Resultado esperado

- O estado "Verificando lances validos" vai durar no maximo ~45 segundos (ao inves de ~5 minutos)
- Nenhum arquivo de codigo sera alterado
- Nenhuma interface sera modificada
- A Edge Function permanece identica

## Impacto
- A Edge Function sera chamada 5x mais frequentemente (1x/min vs 1x/5min)
- Cada execucao leva ~3-8 segundos, entao o impacto e minimo
