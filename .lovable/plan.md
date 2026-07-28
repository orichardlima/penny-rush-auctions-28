## Diagnóstico

Você estava certo: deveria aparecer **5/12**, não 1/12.

- **"Convertidos: 5 base em 2 leilões finalizados"** lê de `bid_lot_consumptions` cruzado com `auctions.status='finished'`.
- **Barra "1/12"** lê do balde `points_accrual_buckets`, que só é alimentado quando `points_settle_auction(auction_id)` roda.
- Existem 2 leilões finalizados do Richard: **Cafeteira** (1 base, settlement rodou → bucket +1) e **Fogão** (4 base, **settlement nunca rodou** → bucket não recebeu os 4).
- Verifiquei `pg_trigger` e `cron.job`: não há **nenhuma** automação que dispare `points_settle_auction` ao finalizar leilão. Está funcionando por acaso (ou execução manual pontual).

## O que fazer

### 1. Trigger automático ao finalizar leilão
Criar `trg_points_settle_on_auction_finish` em `public.auctions`:
- `AFTER UPDATE` quando `OLD.status <> 'finished' AND NEW.status = 'finished'`.
- Chama `PERFORM public.points_settle_auction(NEW.id);`
- `SECURITY DEFINER` na função wrapper para não quebrar em contextos sem privilégio.
- Envolvido em `BEGIN/EXCEPTION WHEN OTHERS` para nunca bloquear a finalização do leilão se o settlement falhar (log + segue).

### 2. Cron de segurança (rede de proteção)
Job `pg_cron` a cada 5 min chamando `points_settle_pending_auctions()` — nova função que varre leilões `finished` sem entrada correspondente em `points_ledger`/bucket nas últimas 24h e roda `points_settle_auction` para cada um. Garante que qualquer settlement perdido (bug futuro, exceção silenciada) seja recuperado.

### 3. Backfill imediato
Rodar `points_settle_auction` para todo leilão `status='finished'` posterior a `points_accrual_started_at` que ainda tenha consumos base sem estar refletido no balde/ledger dos usuários. Depois do backfill, o Richard vai passar de **1/12 → 5/12** conforme esperado.

### 4. Validação
- Consultar `points_accrual_buckets` do Richard → esperado `eligible_bids_remaining = 5`.
- Abrir `/meus-pontos` → barra deve mostrar **5/12, Faltam 7**.
- Confirmar que "Aguardando" continua com 11 (Micro-ondas segue ativo — correto).

## Detalhes técnicos

- Migration única com: função `points_settle_auction_safe(uuid)` (wrapper com try/catch), trigger na tabela `auctions`, função `points_settle_pending_auctions()`, cron job de 5 min, e bloco `DO $$ ... $$` para backfill.
- Não altera regras de negócio (12:1, bots inelegíveis, base vs bônus, `audience_mode`). Apenas garante que o settlement realmente rode.
- Sem mudanças de UI.
