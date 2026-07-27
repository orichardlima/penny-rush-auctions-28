# Rollback — Fase 3 v2

## Nada aplicado em produção

- Migration `003_up.sql` **NÃO** executada.
- Nenhuma flag alterada. `points_accrual_started_at = NULL`.
  `audience_mode` inexistente em produção.
- Webhooks VeoPag e MagenPay **NÃO** redeployados — apenas diff em branch.
- `points_rules` seguirá vazio até a migration ser aplicada.

## Se a migration for aplicada por engano

1. Executar `003_down.sql` na mesma conexão.
2. Verificar:
   ```sql
   SELECT to_regclass('public.points_rules');            -- NULL
   SELECT to_regclass('public.points_reversal_cases');   -- NULL
   SELECT to_regclass('public.payment_reversal_events'); -- NULL
   SELECT column_name FROM information_schema.columns
    WHERE table_name='bid_lots' AND column_name='payment_eligible_for_points'; -- 0 linhas
   ```
3. A migration não faz backfill: o rollback apenas remove estruturas.

## Se webhooks forem redeployados por engano

Reverter os arquivos `supabase/functions/veopag-webhook/index.ts` e
`supabase/functions/magen-webhook/index.ts` para o commit anterior. Enquanto
a RPC canônica não existir em produção, uma chamada acidental retornará
`function does not exist` — o código deve fazer fallback para
`credit_purchase_bids`. Recomendado que o diff em branch inclua o try/catch
antes de subir.

## Se `points_admin_activate_pilot` for chamada por engano

Como validação de pré-condições (`webhooks_validated=true`) bloqueia a
execução, o pior caso é a auditoria registrar tentativa. Para reverter uma
ativação de fato:

```sql
BEGIN;
UPDATE public.points_program_settings_bool
   SET value=false WHERE key IN ('points_program_enabled','points_accrual_enabled');
UPDATE public.points_program_settings_json
   SET value=jsonb_build_object('mode','off') WHERE key='audience_mode';
UPDATE public.points_rules SET is_active=false WHERE rule_code='POINTS_STANDARD';
DELETE FROM public.points_program_settings_time WHERE key='points_accrual_started_at';
COMMIT;
```

`active_from` da regra **não** é revertido (imutabilidade histórica). Os
bids emitidos entre ativação e reversão permanecem com seu `points_rule_id`
snapshot, mas nada será liquidado enquanto o programa estiver desligado.

## Autorização

Este pacote está autorizado apenas para **desenvolver, migrar e testar em
branch**. Ativação em produção, definição de corte, audiência, emissão de
pontos, visibilidade da loja e processamento de resgates permanecem
**bloqueados** até nova decisão explícita.
