
# Fase 1A — Etapa 3: Edge Functions + config.toml

**Ação necessária:** clicar em **Implementar plano** para eu sair do plan mode e gravar os arquivos.

## Secrets (já criados)
- `PERFORMANCE_TRACKING_SALT` (64 chars) — só para hash IP/UA.
- `PERFORMANCE_CRON_SECRET` (64 chars) — só para cron.

## Arquivos a gravar

### 1. `supabase/functions/track-referral/index.ts`
- `verify_jwt=false`. Aceita `GET /track-referral/:code` (302) e `POST /track-referral` (JSON).
- Zod `.strip()` descarta campos server-only silenciosamente. Regex code: `^[A-Za-z0-9_-]{3,64}$`.
- POST: cap 4KB → 413; JSON inválido → 400 `malformed_json`; schema inválido → 400 `invalid_payload`.
- GET com code inválido/inexistente/inativo → **sempre 302 landing** (nunca vaza status).
- `ip_hash`/`ua_hash` = SHA-256(`SALT + "|" + valor`). IP: `x-forwarded-for` → `cf-connecting-ip` → `x-real-ip` → `"unknown"`.
- Rate limit in-memory 60s/30 req por `ip_hash|code` (best-effort, comentado).
- **Self-click** apenas via `Authorization: Bearer <jwt>` server-side (`supabase.auth.getUser`). Cliente nunca envia `auth_user_id`.
- Allowlist enxuta: `showdelances.com`, `www.showdelances.com`, `testeleilao.site`, `www.testeleilao.site`, `penny-rush-auctions-28.lovable.app`, `id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app`. Fora disso → força landing padrão + `metadata.host_flag="host_not_allowed"`.
- Failsafe global `try/catch` → log em `performance_audit_logs`, redirect (GET) ou 200 `internal_error` (POST).

### 2. `supabase/functions/recalculate-weekly-scores/index.ts`
- `verify_jwt=false`, POST-only (405 nos demais).
- Exige `x-cron-key === PERFORMANCE_CRON_SECRET`. Sem match → 401 + log (sem stack).
- **`week_start` timezone-safe `America/Bahia`** via `Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" })` + aritmética UTC para achar segunda-feira:
  ```ts
  function bahiaTodayISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bahia",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  }
  function toMondayISO(dateISO: string) {
    const [y, m, d] = dateISO.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m-1, d)).getUTCDay();
    const back = dow === 0 ? 6 : dow - 1;
    const dt = new Date(Date.UTC(y, m-1, d));
    dt.setUTCDate(dt.getUTCDate() - back);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}-${String(dt.getUTCDate()).padStart(2,"0")}`;
  }
  ```
  Body opcional `{ week_start }` validado regex `^\d{4}-\d{2}-\d{2}$` e normalizado com `toMondayISO`.
- Chama `rpc("calculate_all_partner_weekly_scores", { p_week_start })`. Erro → log + 500 `internal_error` sem stack.

### 3. `supabase/config.toml` (adicionar ao final)
```toml
[functions.track-referral]
verify_jwt = false

[functions.recalculate-weekly-scores]
verify_jwt = false
```

## Zero diff garantido
`veopag-webhook`, `partner-payment-webhook`, `partner-weekly-payouts`, `Auth.tsx`, `App.tsx`, `useReferralTracking.ts`, `affiliate_*`, `partner_contracts`, `partner_binary_positions`, `bids`, `orders`, `auctions`, `partner_payouts`, `fury_vault_*` — não tocados. Edições cirúrgicas ficam para Etapa 4.

## Testes (após gravação)
1. Clique válido → 302 landing padrão + linha em `tracking_events`.
2. **Clique duplicado, mesmo `visitor_id+code` dentro da janela `click_dedupe_hours` (inicialmente 6h)** → 302 + `is_dedupe=true`.
3. Código inexistente → 302 landing + linha com `attempted_code`.
4. Link inativo (`is_active=false`) → 302 landing + `fraud_flags` marcando.
5. Open redirect (`?landing=https://evil.com`) → 302 landing padrão + `metadata.host_flag="host_not_allowed"`.
6. Cron sem `x-cron-key` → 401 + log.
7. Cron com `x-cron-key` válido → 200 + scores calculados para semana Bahia atual.
8. POST > 4KB → 413 `payload_too_large`.
9. POST JSON malformado → 400 `malformed_json`.

Relatório completo com resultados + confirmação de zero diff enviado logo após.
