

# Corrigir agendamento do cron job partner-weekly-payouts

## Problema

O cron job atual esta configurado com schedule `5 23 * * 0` (domingo 23:05 UTC), que corresponde a domingo 20:05 BRT. A Edge Function rejeita a execucao porque verifica se e domingo apos 23h no horario de Brasilia, e nesse horario ainda sao 20h.

## Solucao

Executar um comando SQL via SQL Editor para atualizar o schedule do cron job:

```text
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'weekly-partner-payouts'),
  schedule := '5 2 * * 1'
);
```

Isso altera o agendamento para segunda-feira 02:05 UTC, que equivale a domingo 23:05 BRT -- o horario correto para o processamento semanal.

## O que NAO muda

- Nenhuma interface (UI) sera alterada
- A Edge Function `partner-weekly-payouts` permanece identica
- A logica de verificacao `isSundayAfter23h` continua funcionando normalmente
- Nenhum outro cron job sera afetado

