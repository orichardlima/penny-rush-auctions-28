## Escopo aprovado

- `_bot_finalize_auction` passa a usar `clock_timestamp()` internamente para `finished_at`.
- `bot_protection_loop` deixa de propagar `v_current_time` compartilhado.
- Nenhum backfill retroativo. Clusters históricos permanecem intocados.
- `auto-replenish-auctions` recebe jitter real em `starts_at`/`ends_at`, respeitando o painel ADM.
- Destravamento manual passa a ser escalonado, nunca `ends_at = now()` em lote.
- Bots, timing dos bots, panic bid, vencedores, pagamentos, parceiros, contratos, binário, repasses, RLS, fury vault e UI pública NÃO são tocados.

---

## 1. Migração SQL

### 1.1 Tabela de controle da fila escalonada

Nova tabela `public.auction_scheduled_finalizations` (só backend/admin):

- `auction_id` (PK, FK `auctions.id`)
- `reason` — `revenue_target` | `max_price` | `inactivity_forced` | `bot_only_batch`
- `bot_only` (boolean)
- `scheduled_for` (timestamptz) — horário futuro planejado, único por minuto
- `queued_at` (timestamptz default `clock_timestamp()`)
- `finalized_at` (timestamptz, nullable) — preenchido quando efetivamente encerrar
- `cancelled_at` (timestamptz, nullable)
- `cancel_reason` (text, nullable) — ex.: `real_bid_received`, `admin_override`
- `notes` (jsonb) — payload livre para auditoria

GRANTs: `service_role ALL`, `authenticated SELECT` apenas se necessário (por ora só `service_role`). RLS habilitado; policy só admin (`has_role(auth.uid(),'admin')`).

Índices: `(scheduled_for)`, `(auction_id) WHERE finalized_at IS NULL AND cancelled_at IS NULL`.

### 1.2 `_bot_finalize_auction`

- Remover uso de `p_current_time` para gravar `finished_at`.
- Novo comportamento: `v_finished_at := clock_timestamp()` no início da gravação.
- `p_current_time` fica apenas como contexto de log (`RAISE LOG '🏁 [BOT-FINALIZE] auction=% reason=% ctx_time=% real_finished_at=%'`).
- Se existir linha ativa em `auction_scheduled_finalizations` para esse auction, marcar `finalized_at = v_finished_at`.

### 1.3 `bot_protection_loop`

Fluxo por leilão dentro do `FOR`:

1. Se leilão tem `ends_at <= clock_timestamp()` (time_limit real) → finaliza imediatamente. Segue caminho normal.
2. Detecta critério bot-only (`revenue_target`, `max_price`, `inactivity_forced`):
   - Se já existe scheduled row ativa → pula (não re-agenda).
   - Se não existe:
     - Calcula `scheduled_for = clock_timestamp() + (3..25 min aleatório)`.
     - Verifica colisão de minuto contra `auctions.ends_at`/`finished_at` (últimas 3h / próximas 3h) e outras `scheduled_for` ativas. Até 20 tentativas; se todas colidirem, força +30s até liberar.
     - `INSERT` na `auction_scheduled_finalizations` com `bot_only=true`, `reason`.
     - Ajusta `auctions.ends_at := scheduled_for` para que o loop natural finalize quando chegar a hora.
     - `RAISE LOG '⏳ [SCHEDULE] auction=% reason=% scheduled_for=%'`.
3. Se leilão já tem scheduled row ativa e `ends_at <= clock_timestamp()` → finaliza (cai no passo 1).

### 1.4 Cancelamento automático por lance real

Trigger `AFTER INSERT ON public.bids`:

- Se `NEW.is_bot = false` E existe linha ativa em `auction_scheduled_finalizations` para `NEW.auction_id`:
  - `UPDATE auction_scheduled_finalizations SET cancelled_at = clock_timestamp(), cancel_reason = 'real_bid_received' WHERE auction_id = NEW.auction_id AND finalized_at IS NULL AND cancelled_at IS NULL`.
  - Estende `auctions.ends_at` de volta ao valor natural (`clock_timestamp() + duração residual do template` — mínimo 60s, respeitando `auctions.duration_seconds` se existir; caso contrário, `+ 5 min`).
  - `RAISE LOG '↩️ [SCHEDULE-CANCEL] auction=% reason=real_bid_received bidder=%'`.

Isso garante que lance real NUNCA sofre encerramento injusto.

### 1.5 RPC `admin_release_stuck_auctions(p_ids uuid[])`

Substitui qualquer `UPDATE auctions SET ends_at = now()` em lote:

```
FOR i, v_id IN enumerate(p_ids):
  new_ends := clock_timestamp() + ((2 + i*5) || ' min')::interval + (random()*120 || ' sec')::interval
  UPDATE auctions SET ends_at = new_ends WHERE id = v_id AND finished_at IS NULL
  INSERT INTO auction_scheduled_finalizations (auction_id, reason, bot_only, scheduled_for, notes)
  RAISE LOG '🔧 [ADMIN-RELEASE] auction=% new_ends=%'
```

Padrão: leilão 1 = +2min, leilão 2 = +7min, leilão 3 = +13min etc., cada um com jitter de até 2min.

---

## 2. Edge Function `auto-replenish-auctions`

Alterações mínimas, sem duplicar lógica:

- Ler as configs atuais do painel ADM (duração min/max, intervalo entre leilões, templates, tiers, pesos, cooldown) como já faz.
- Ao gerar cada `starts_at`/`ends_at`:
  1. Base = cálculo atual (respeitando duração e intervalo do painel).
  2. Aplicar jitter: `starts_at += random(-90s..+90s)`, `ends_at += random(-90s..+180s)`, respeitando limites min/max de duração.
  3. Antes do INSERT, `SELECT 1 FROM auctions WHERE ends_at BETWEEN candidate - 90s AND candidate + 90s` — se existir, re-sortear jitter (até 20 tentativas). Se todas falharem, deslocar `+3min` determinístico.
  4. Garantir `starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at + duração_min`.
- Log estruturado por leilão criado: `auction_id`, `template_id`, `starts_at`, `ends_at`, `jitter_applied_seconds`.

Nenhuma alteração em templates, tiers, pesos, cooldown ou seleção de produto.

---

## 3. Logs (padrão único)

Todos os pontos gravam `RAISE LOG` (visível em Postgres logs) contendo:

- `auction_id`
- `reason` (elegibilidade / cancelamento)
- `bot_only` (bool)
- `scheduled_for` (quando aplicável)
- `real_finished_at` (quando aplicável)
- `cancelled` + `cancel_reason` (quando aplicável)

A tabela `auction_scheduled_finalizations` funciona como registro persistente auditável dos mesmos campos.

---

## 4. Validação pós-deploy (checklist)

1. Query de clusters por minuto (últimos 7 dias) → só os 3 clusters históricos aparecem.
2. `SELECT auction_id, scheduled_for, finalized_at, finalized_at - scheduled_for AS drift FROM auction_scheduled_finalizations WHERE finalized_at IS NOT NULL ORDER BY finalized_at DESC LIMIT 50` → drifts pequenos e horários distribuídos.
3. `SELECT * FROM auction_scheduled_finalizations WHERE cancelled_at IS NOT NULL` → confirma cancelamentos por lance real quando ocorrerem.
4. Reposição: `SELECT id, starts_at, ends_at FROM auctions WHERE created_at > now() - interval '1 day' ORDER BY ends_at` → sem `ends_at` colidindo em ±90s.
5. Bots continuam finalizando leilões normalmente (checar `orders` gerados normalmente).
6. Nenhum leilão com lance real recente foi encerrado prematuramente (comparar `bids` último `is_bot=false` com `finished_at`).

---

## Fora de escopo

Atuação/timing dos bots, `bot-exec`, `bot-tick`, `sync-timers-protection`, panic bid, distribuição de lances, pagamentos, parceiros, contratos, binário, repasses, RLS de outras tabelas, UI pública, regras de vencedor, open-win, predefined winner, fury vault. Nenhum arquivo de frontend será modificado.

## Arquivos afetados

- **Migração SQL** — nova tabela `auction_scheduled_finalizations` (+ GRANTs + RLS), `_bot_finalize_auction`, `bot_protection_loop`, trigger `trg_cancel_scheduled_on_real_bid` em `bids`, RPC `admin_release_stuck_auctions`.
- **`supabase/functions/auto-replenish-auctions/index.ts`** — jitter + verificação anti-colisão.
