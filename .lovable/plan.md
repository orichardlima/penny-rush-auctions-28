
## Plano: Implementação Completa de Melhorias

**STATUS: ✅ IMPLEMENTADO**

### Etapa 5 — Visibilidade de Leilões (P1) ✅
- `finished_auctions_display_hours` atualizado de 48 para **18 horas**
- Policy SELECT de `auctions` agora filtra `is_hidden = false OR is_admin_user(auth.uid())`
- Leilões ocultos invisíveis para não-admins (correção de segurança)

### Etapa 1 — Segurança (P0) ✅
- Trigger `protect_profile_fields` protege `is_admin`, `is_blocked`, `bids_balance` contra alteração por usuários
- Trigger `protect_partner_contract_fields` protege campos financeiros em `partner_contracts`
- Policy INSERT em `affiliates` restringe `role='affiliate'` e `status='pending'`
- `search_path = public` fixado em todas as funções (is_admin_user, get_user_affiliate_id, is_affiliate_manager, close_binary_cycle, get_binary_tree, prevent_bids_on_inactive_auctions, preview_binary_cycle_closure, propagate_binary_points)

### Etapa 1.1 — Hardening de Segurança (P0) ✅
- Policy anon `Public can view limited profile info` REMOVIDA (expunha PII de 1.408 usuários)
- Policy ALL `Admins can manage all profiles` DIVIDIDA em 4 policies separadas (SELECT/INSERT/UPDATE/DELETE) para evitar escalação de privilégio via OR de permissive policies
- WITH CHECK em INSERT de profiles: `is_admin = false AND is_bot = false`
- WITH CHECK em UPDATE de profiles: bloqueia `is_admin=true` para não-admins
- Função `get_public_profiles(uuid[])` SECURITY DEFINER criada para lookup seguro de nomes em lote
- Função `get_contract_by_referral_code(text)` SECURITY DEFINER criada para lookup público de contratos
- Policy pública de `partner_contracts` REMOVIDA (expunha PIX, bank_details, saldos)
- Policy `Anyone can view all bids` → `Authenticated can view all bids`
- Policy `Anyone can view qualification counts` em fury_vault_qualifications REMOVIDA
- Policy `Anyone can view revenue snapshots` → `Authenticated can view revenue snapshots`
- Policy `Anyone can read system settings` → `Authenticated can read system settings`
- Policy `Anyone can view binary cycles` → `Authenticated can view binary cycles`
- Frontend atualizado: Auth.tsx, UserProfileCard.tsx, AffiliateReferralsList.tsx, useReferralBonuses.ts, usePartnerReferrals.ts, usePartnerContract.ts agora usam RPC em vez de queries diretas a profiles/partner_contracts

### Etapa 1.2 — Correções de Vulnerabilidades Críticas (P0) ✅
- `affiliate_referrals` INSERT: forçado `converted = false` (impede conversões falsas)
- `bid_purchases` INSERT policy do usuário REMOVIDA (INSERT feito por edge function server-side)
- `partner_referral_bonuses` INSERT policy do usuário REMOVIDA (INSERT feito por trigger server-side)
- `partner_upgrades` INSERT policy do usuário REMOVIDA (INSERT feito por webhook server-side)
- `protect_partner_contract_fields` trigger REFORÇADO: protege status, total_cap, weekly_cap, aporte_value, total_received, total_withdrawn, available_balance, total_referral_points, plan_name, referral_code, payment_status, bonus_bids_received

### Etapa 2 — Negócio (P2) ✅
- Trigger `handle_new_user` atualizado para criar automaticamente conta de afiliado com código único e `status='active'`
- Configurações `affiliate_repurchase_enabled=true` e `affiliate_repurchase_commission_rate=10` inseridas em `system_settings`

### Etapa 3 — Arquitetura (P2) ✅
- `AdminDashboard.tsx` refatorado de ~1834 linhas para ~250 linhas (orquestrador)
- Sub-componentes extraídos: `AuctionDetailsTab`, `AuctionManagementTab`, `UserManagementTab`, `PackagesManagementTab`
- Tipos e helpers compartilhados em `AdminDashboard/types.ts` e `AdminDashboard/helpers.ts`
- Queries paralelas com `Promise.all` no fetch de dados admin

### Etapa 4 — Performance (P3) ✅
- Todas as rotas (exceto Index) convertidas para `React.lazy()` com `Suspense`
- `QueryClient` configurado com `staleTime: 5min` e `gcTime: 10min`

### Avisos Restantes (requerem ação no Dashboard Supabase)
- Extension pg_net no schema public → mover para extensions
- RLS policy always true (affiliate_referrals INSERT — agora restrito a converted=false)
- OTP expiry longo → reduzir no dashboard
- Leaked password protection desabilitada → habilitar no dashboard
- Postgres com patches disponíveis → atualizar no dashboard
