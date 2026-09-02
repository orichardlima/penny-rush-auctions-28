# Plano de Validação — Cron Consolidado de Bônus

## Objetivo
Confirmar que o job consolidado `bonus-maintenance-30min` dispara sozinho e processa corretamente, sem recorrência do erro `job startup timeout`.

## Passos
1. **Aguardar o próximo disparo** do cron (schedule `17,47 * * * *`; próxima execução após 02:47 UTC).
2. **Verificar execução automática** consultando `bonus_maintenance_runs` por registro com `trigger_source = 'CRON'` e `status = 'SUCCESS'`.
3. **Confirmar fila limpa**: `partner_referral_bonuses` continua com `0` registros `PENDING` vencidos (`available_at <= NOW()`).
4. **Reportar resultado** ao usuário com: horário da execução, quantidade liberada/expirada e status.

## Critério de sucesso
- Registro automático em `bonus_maintenance_runs` com `status = 'SUCCESS'`.
- `0` bônus vencidos pendentes.
- Nenhum erro de worker saturation/saturação nos logs do cron.

## Risco residual
Se o job não aparecer após o horário esperado, investigar se o Supabase `pg_cron` está ativo e se o job `bonus-maintenance-30min` continua `active`.
