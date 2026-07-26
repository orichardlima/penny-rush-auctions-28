
# Fase 1 v3 — Entrega em branch (sem deploy)

Todas as suas 10 decisões estão incorporadas. Nada roda em produção. Nada altera saldo, lote antigo, bid histórico ou webhook.

## 1. Rota admin `/admin/pontos-loja`

- Nova página `src/pages/AdminPontosLoja.tsx` protegida por `is_admin_user`.
- Registrada em `App.tsx`.
- Card "Pontos & Loja Show" em `src/components/AdminDashboard.tsx` linkando para a rota.
- Nesta fase renderiza só: Feature Flags, Data de ativação (read-only nesta fase), Proporção, Origens elegíveis, Audiência piloto, Prioridade de consumo, Diagnóstico de rastreabilidade.
- Todos os controles sensíveis vêm com **gate de pré-requisitos**: o botão "Ativar acúmulo" só destrava quando `points_accrual_started_at IS NOT NULL AND points_lot_consumption_enabled=true AND existe_regra_ativa AND webhooks_validados=true AND audiencia_configurada=true`. Enquanto faltar algo, o painel lista o que falta.

## 2. Migration SQL (uma migration só)

### 2.1 Tabelas de configuração (kv tipado)

```
points_program_settings_bool (key text PK, value boolean NOT NULL,
  is_admin_only boolean NOT NULL DEFAULT false, updated_at, updated_by)
points_program_settings_num  (key text PK, value numeric NOT NULL, ...)
points_program_settings_time (key text PK, value timestamptz NULL, ...)
points_program_settings_json (key text PK, value jsonb NOT NULL, ...)
```

Chaves semeadas (todas seguras):
- bool: `points_program_enabled=false`, `points_accrual_enabled=false`, `points_lot_consumption_enabled=false`, `points_store_enabled=false`, `points_redemption_enabled=false`, `points_campaigns_enabled=false`, `webhooks_validated=false`, `audience_configured=false`
- num: `points_bids_per_point=12`
- time: `points_accrual_started_at=NULL`, `points_program_started_at=NULL`
- json: `points_consumption_priority=["eligible_paid","legacy"]`, `points_eligible_sources=["paid_purchase"]`, `points_eligible_auctions="all"`, `points_pilot_users=[]`, `points_campaigns=[]`

Helpers `SECURITY DEFINER STABLE`: `points_get_bool/num/time/json(key, default)`.

RLS:
- SELECT `authenticated` só onde `is_admin_only=false`.
- Escrita bloqueada; apenas via RPC admin `points_admin_set_bool/num/time/json` (com `is_admin_user(auth.uid())`) + log em `points_program_settings_audit`.
- GRANT SELECT p/ `authenticated` nas 4 tabelas + `GRANT ALL` p/ `service_role`.

### 2.2 Colunas novas — todas aditivas, nullable/default seguro

`bid_lots`:
- `eligible_for_points boolean NOT NULL DEFAULT false` (⇒ 100% dos lotes legados ficam automaticamente não-elegíveis, sem UPDATE)
- `payment_gateway text NULL`, `external_payment_id text NULL`, `bid_purchase_id uuid NULL`, `purchased_at timestamptz NULL`, `idempotency_key text NULL`
- Índices `UNIQUE (payment_gateway, external_payment_id) WHERE payment_gateway IS NOT NULL`, `UNIQUE (idempotency_key) WHERE idempotency_key IS NOT NULL`
- Índice parcial `(user_id, purchased_at) WHERE eligible_for_points=true AND remaining_amount>0`

`bids`:
- `source text NULL`, `lot_id uuid NULL`, `eligible_for_points boolean NOT NULL DEFAULT false`, `is_test boolean NOT NULL DEFAULT false`
- `points_rule_id uuid NULL`, `points_campaign_id uuid NULL`, `points_multiplier_snapshot numeric NULL`
- `audience_version_snapshot int NULL`, `points_program_active_at_bid boolean NULL`, `points_accrual_active_at_bid boolean NULL`, `accrual_started_at_snapshot timestamptz NULL`
- `tracking_status text NOT NULL DEFAULT 'pre_cutoff'` — `pre_cutoff | tracked | legacy`
- Todas as colunas NULL/default preenchidas **dentro do INSERT** (ver §3) — nenhum UPDATE pós-insert de metadados.

`profiles`:
- `is_test_account boolean NOT NULL DEFAULT false`

### 2.3 Novas tabelas de suporte

```
bid_lot_consumptions (id PK, bid_id FK, lot_id FK, amount_consumed numeric,
  source text, eligible_for_points boolean, bid_purchase_id uuid NULL, created_at)
points_bid_reconciliation_queue (id PK, bid_id FK NULL, user_id, reason text,
  requested_amount numeric, available_amount numeric, created_at)
points_program_settings_audit (id, key, table_type, old_value, new_value, actor, created_at)
```

RLS: só admin lê `points_bid_reconciliation_queue` e `points_program_settings_audit`. `bid_lot_consumptions` — dono lê o próprio via join com `bids.user_id`.

### 2.4 Função `consume_bid_lots_for_bid(p_user uuid, p_amount numeric, p_bid_id uuid) RETURNS boolean`

- `SECURITY DEFINER`, `SET search_path=public`.
- `SELECT ... FOR UPDATE` em `bid_lots` do usuário com `remaining_amount>0` e `(expires_at IS NULL OR expires_at>now())`, ordenados por bucket:
  - **Bucket 1**: `eligible_for_points=true AND purchased_at > points_accrual_started_at` (FIFO por `purchased_at`).
  - **Bucket 2**: demais.
  - Ordem entre buckets vem de `points_consumption_priority` (default `["eligible_paid","legacy"]`).
- Se soma < `p_amount` → `RAISE EXCEPTION 'insufficient_lot_balance'` (tudo-ou-nada, sem side effect).
- Para cada lote tocado: `UPDATE remaining_amount` + `INSERT bid_lot_consumptions`.
- Retorna `true` se **todos** os consumos vieram do bucket 1 (⇒ bid 100% elegível); `false` caso contrário.
- `consume_bid_lots` antiga **não** é alterada nem removida.

### 2.5 Função `place_bid_as(p_actor uuid, p_target uuid, p_auction uuid)`

- `SECURITY DEFINER`, restrita a `service_role` (checa `current_setting('request.jwt.claim.role', true)`).
- Encapsula chamada a `place_bid` para bots/admins. Nenhuma assinatura de bot existente muda.

## 3. Diff unificado do `place_bid` (aditivo, sem reordenar linhas atuais)

Estrutura do novo caminho, calculando snapshots **antes** do INSERT (evita segundo trigger de UPDATE):

```
1) Verificar auth.uid()=p_user_id OU role='service_role'  -- novo
2) SELECT FOR UPDATE em auctions + validações existentes  -- inalterado
3) Ler settings numa única query:                          -- novo
   program_on, accrual_on, consumption_on, started_at,
   audience(pilot_users), eligible_auctions, is_test, is_bot, is_admin
4) Calcular snapshots em variáveis locais:                 -- novo
   accrual_active := consumption_on AND started_at IS NOT NULL AND now()>started_at
5) INSERT INTO bids (...campos atuais...,
     source, lot_id, eligible_for_points=false,           -- default; será refinado abaixo
     is_test, points_program_active_at_bid=program_on,
     points_accrual_active_at_bid=accrual_active,
     accrual_started_at_snapshot=started_at,
     tracking_status = CASE
        WHEN NOT accrual_active THEN 'pre_cutoff'
        ELSE 'tracked' END)
   RETURNING id INTO v_bid_id
6) IF consumption_on THEN
     BEGIN
       v_all_eligible := consume_bid_lots_for_bid(p_user_id, 1, v_bid_id);
     EXCEPTION WHEN OTHERS THEN
       INSERT INTO points_bid_reconciliation_queue(...);
       -- lance segue via débito legado (comportamento atual)
       v_all_eligible := false;
       -- marca bid como legacy sem UPDATE — usa CTE no INSERT acima?
     END;
   ELSE v_all_eligible := false; END IF;
7) Débito em profiles.bids_balance                         -- inalterado
8) Todos os UPDATE/INSERT existentes (líder, preço, timer, last_bidders, bot triggers) -- inalterado
```

**Resolvendo a preocupação #9 (triggers em UPDATE de `bids`):**

Auditei triggers em `bids` (a entregar no material): se qualquer trigger `AFTER UPDATE` recalcular líder/timer/preço/bot, **NÃO** faço UPDATE de metadados no bid recém-criado. Em vez disso:

- Os snapshots `tracking_status`, `points_*_active_at_bid`, `accrual_started_at_snapshot`, `source`, `lot_id` e `eligible_for_points` **entram todos no INSERT**.
- Para `eligible_for_points` e `source`/`lot_id`, faço o consumo de lotes **antes** do INSERT (chamada auxiliar `preview_consume_bid_lots` que apenas seleciona `FOR UPDATE` e simula) → obtenho o resultado → INSERT com valores finais → então `commit_consume_bid_lots` grava as decrementações e `bid_lot_consumptions`. Assim nunca há UPDATE de metadados no bid, apenas o INSERT canônico.

Se a auditoria mostrar que só há triggers `AFTER INSERT` (sem UPDATE relevante), volto ao padrão INSERT→consume→UPDATE. Mas por segurança, a entrega adota a variante preview/commit acima. Documento a decisão no material.

## 4. Testes Deno (`supabase/functions/_tests/points_phase1_test.ts`)

Rodados via `supabase--test_edge_functions` em branch. Cada cenário isolado em transação com `ROLLBACK`.

1. Baseline off — todas flags off: `place_bid` produz saldo idêntico; `bids.tracking_status='pre_cutoff'`, `eligible=false`; nenhum registro em `bid_lot_consumptions`.
2. `consumption_on=true` + `started_at=NULL` → consumo roda; todos os bids `eligible=false`, `tracking_status='tracked'`.
3. `consumption_on=true` + `started_at` no passado + usuário fora do piloto → `eligible=false`.
4. Idem + usuário no piloto + lote sintético (`eligible=true, purchased_at>corte`) → `eligible=true`; snapshots preenchidos.
5. Bucket 1 acaba no meio → bid inteiro `eligible=false` (política 100%).
6. Bot / admin / `is_test_account` → sempre `eligible=false`.
7. Segurança: user A tenta `place_bid` para user B → `RAISE 'forbidden'`, saldo de B intacto.
8. Concorrência: 20 `place_bid` paralelos para o mesmo user com 20 lotes elegíveis → nenhum double-spend, `sum(bid_lot_consumptions.amount)=20`, saldo final consistente.
9. Regressão de triggers: `expire_bid_lots` continua funcionando; `consume_bid_lots` antiga inalterada; triggers em `bids` (preço/líder/timer/bot) disparam exatamente o mesmo número de vezes de antes (contador antes/depois).

Testes extras de segurança:
- Não-admin tentando `points_admin_set_bool` → erro.
- Não-admin lendo `points_program_settings_audit` → 0 linhas.
- `place_bid_as` chamado por não-service_role → erro.

## 5. Benchmarks

Script Deno mede `place_bid` p50/p95/p99 com N=500:
- (a) baseline (main), (b) branch com todas as flags off, (c) branch com `consumption_on=true` + lotes elegíveis, (d) idem sem lote elegível (fallback legado). Reportar diferença absoluta e %.

## 6. Rollback

Migration reversa entregue junto (mesmo arquivo, em bloco comentado + `.down.sql` de referência):
- `DROP FUNCTION consume_bid_lots_for_bid, place_bid_as, points_get_*, points_admin_set_*`.
- Restaurar `place_bid` do baseline (backup textual da definição atual anexado ao material).
- `DROP TABLE bid_lot_consumptions, points_bid_reconciliation_queue, points_program_settings_audit, points_program_settings_bool/num/time/json`.
- `ALTER TABLE bids DROP COLUMN` (11 colunas novas), `ALTER TABLE bid_lots DROP COLUMN` (6 novas), `ALTER TABLE profiles DROP COLUMN is_test_account`.
- Como zero linha em dado histórico foi escrita, o rollback é DROP puro.

## 7. Relatório final (o que você recebe antes do deploy)

1. SQL completo aplicável em branch (uma migration).
2. Diff unificado do `place_bid` (antes/depois).
3. Auditoria dos triggers atuais em `bids` (INSERT/UPDATE) com decisão sobre INSERT-only vs UPDATE.
4. Log de cada teste (aprovado/reprovado, tempo, stdout).
5. Benchmark comparativo.
6. Confirmações explícitas: nenhuma flag ativada, nenhum saldo/lote/bid histórico alterado, nenhum ponto emitido, `points_accrual_started_at=NULL`.
7. Script de rollback pronto.

Só após seu OK sobre esse relatório o deploy em produção é considerado.

## 8. Fora de escopo (bloqueado por design nesta fase)

Webhooks (veopag/magen), `sync_bid_lots_on_profile_update`, cancelamentos/estornos/chargebacks, wallet de pontos, loja, produtos, resgates, UI de parceiro, ledger de pontos, cron de expiração, backfill, correção dos 2 usuários/2 lotes fracionários, correção dos 177 lotes expirados.

---

**Próxima ação ao aprovar este plano:** entrar em build mode e gerar a migration + diff + testes + relatório em branch, sem tocar nas flags.
