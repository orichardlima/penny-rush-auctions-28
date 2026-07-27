# Rollback — Fase 3

## Nada aplicado em produção

- Migration `003_up.sql` NÃO executada.
- Nenhuma flag alterada. `points_accrual_started_at = NULL`. `audience_mode`
  inexistente em produção.
- Webhooks VeoPag e MagenPay NÃO redeployados — apenas diff em branch.

## Se a migration for aplicada por engano

1. Executar `003_down.sql` na mesma conexão.
2. Verificar:
   ```sql
   SELECT to_regclass('public.points_rules');           -- NULL
   SELECT to_regclass('public.payment_reversal_events'); -- NULL
   SELECT column_name FROM information_schema.columns
    WHERE table_name='bid_lots' AND column_name='idempotency_key'; -- 0 linhas
   ```
3. Nenhum dado histórico é apagado: a migration não faz backfill, portanto o
   rollback apenas remove estruturas vazias.

## Se os webhooks forem redeployados por engano

Reverter para o commit anterior do diretório `supabase/functions/veopag-webhook/`
e `supabase/functions/magen-webhook/`. Como a RPC canônica não existirá em
produção enquanto a migration não for aplicada, uma chamada acidental
retornará erro `function does not exist` — o webhook precisa capturar esse
erro e cair de volta em `credit_purchase_bids`. Isso está descrito no diff,
mas fica registrado aqui como salvaguarda.

## Autorização

Este pacote está autorizado apenas para **desenvolver, migrar e testar em
branch**. Ativação em produção, definição de corte, audiência, emissão de
pontos, visibilidade da loja e processamento de resgates permanecem
**bloqueados** até nova decisão explícita.
