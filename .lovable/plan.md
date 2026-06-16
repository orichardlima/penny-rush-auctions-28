
# Validade de 30 dias para lances

Hoje os lances ficam num saldo único em `profiles.bids_balance`, sem rastreamento por lote. Para suportar expiração, precisamos passar a controlar **lotes de lances** com data de validade própria, mantendo `bids_balance` como total derivado (compatibilidade com todo o código atual de leitura/lance).

## Regras de negócio aprovadas

- **Origens com validade de 30 dias**: lances comprados (pacotes via PIX) e bônus de adesão de plano de parceiro (`partner_contracts`).
- **Sem validade**: bônus de upgrade, signup, indicação, fury vault, ajustes admin, promoções — continuam eternos.
- **Consumo**: FIFO por data de expiração (lote que vence antes é consumido primeiro). Lotes sem expiração só são tocados depois que não há mais lotes com prazo.
- **Avisos**: e-mail 7 dias e 1 dia antes + notificação in-app (sininho) com a quantidade que vai expirar.
- **Migração**: todo o saldo atual dos usuários ganha expiração = hoje + 30 dias (lote único de migração por usuário).

## Arquitetura

### Nova tabela `bid_lots`

```text
bid_lots
├── id uuid pk
├── user_id uuid (profiles)
├── source text  -- 'purchase' | 'partner_contract' | 'partner_upgrade'
│                --           | 'signup_bonus' | 'referral' | 'fury_vault'
│                --           | 'admin_adjustment' | 'promotion' | 'migration'
├── source_ref uuid          -- id da compra/contrato/etc (nullable)
├── initial_amount int       -- lance entregues
├── remaining_amount int     -- saldo restante neste lote
├── expires_at timestamptz   -- NULL = nunca expira
├── expired_amount int       -- quanto já foi expirado deste lote
├── notified_7d_at timestamptz
├── notified_1d_at timestamptz
├── created_at, updated_at
```

`profiles.bids_balance` continua existindo e é mantido por trigger como `SUM(remaining_amount)` dos lotes do usuário.

### Função `consume_bids(user_id, amount)`

`SECURITY DEFINER`, usada por `place_bid`:
1. `SELECT ... FOR UPDATE` dos lotes com `remaining_amount > 0`, ordenados por `expires_at NULLS LAST, created_at ASC`.
2. Decrementa `remaining_amount` em cascata até cobrir `amount`.
3. Atualiza `profiles.bids_balance` no mesmo statement.
4. Retorna erro se saldo insuficiente.

`place_bid` passa a chamar `consume_bids` em vez de decrementar `bids_balance` diretamente.

### Crédito (triggers)

Substituir/encapsular os pontos onde hoje incrementamos `bids_balance`:
- `bid_purchases` (após confirmação PIX): cria lote `source='purchase'`, `expires_at = now() + 30 days`.
- `trg_credit_bonus_bids_on_contract`: cria lote `source='partner_contract'`, `expires_at = now() + 30 days`.
- `partner_upgrades`, fury vault, referral, signup, ajustes admin: criam lote `expires_at = NULL`.

Cada trigger continua atômico — a única mudança é gravar o lote, e o trigger que mantém `bids_balance` sincroniza o agregado.

### Cron de expiração

`cron.schedule('expire-bid-lots', '5 * * * *', ...)` chamando função `expire_bid_lots()`:
- Para cada lote com `expires_at < now()` e `remaining_amount > 0`: incrementa `expired_amount`, zera `remaining_amount`, recalcula `bids_balance`, registra evento.
- Idempotente.

### Cron de avisos

`cron.schedule('notify-bid-expirations', '0 12 * * *', ...)`:
- 7d: lotes com `expires_at` em [now()+6.5d, now()+7.5d] e `notified_7d_at IS NULL` e `remaining_amount > 0`.
- 1d: lotes com `expires_at` em [now()+0.5d, now()+1.5d] e `notified_1d_at IS NULL` e `remaining_amount > 0`.
- Agrega por usuário (1 e-mail/notificação por janela), marca `notified_*_at`, envia e-mail (`send-transactional-email`, novo template `bid-expiration-warning`) e cria `notifications` row.

### Migração de saldo atual

Migration única que para cada usuário com `bids_balance > 0`:
- Cria lote `source='migration'`, `initial_amount = bids_balance`, `remaining_amount = bids_balance`, `expires_at = now() + 30 days`.

## UI (mudanças mínimas, não-disruptivas)

- `UserProfileCard` / Header `bids_balance`: tooltip "Próximo a expirar: X lances em DD/MM" se houver lote com expiração próxima.
- Página `/pacotes` ou Dashboard do usuário: nova seção "Meus lances" mostrando os lotes ativos (origem, quantidade, expira em). Listagem somente leitura.
- Toast `useToast` quando saldo é debitado e o lote consumido tinha expiração próxima: mensagem informativa.

Nada muda em `place_bid`, `AuctionCard`, fluxo de PIX, partner contracts, etc., do ponto de vista do usuário e da API.

## Detalhes técnicos

- Tabela `bid_lots`: RLS — usuário lê os próprios lotes (`auth.uid() = user_id`); apenas service_role insere/atualiza; GRANT `SELECT` para `authenticated`, `ALL` para `service_role`.
- Trigger `trg_sync_bids_balance` em `AFTER INSERT OR UPDATE OF remaining_amount` recalcula `profiles.bids_balance`.
- Novo template React Email `bid-expiration-warning.tsx` em `_shared/transactional-email-templates/` com props `{ amount, expiresAt, when: '7_days' | '1_day' }`, registrado em `registry.ts`.
- Notificação in-app criada em `notifications` com `type='bid_expiration_warning'`.
- `useEffect` no `AuthContext.refreshProfile` continua retornando `bids_balance` agregado (sem mudança).
- Painel admin (Monitor Bots já existente fica intocado) ganha aba simples "Lotes de Lances" opcional — pode ficar de fora deste plano se preferir; default: incluído como leitura somente.

## Fora de escopo

- Devolução/recompra de lances expirados.
- Histórico de consumo lote-a-lote para auditoria avançada (registramos via `bid_lots` mas não construímos UI completa).
- Configurar a validade por origem na UI admin (hardcoded 30 dias por enquanto).
- Mudança de validade retroativa (regra "saldo atual = 30 dias" é one-shot na migration).
