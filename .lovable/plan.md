

## Plano: Vincular patrocinador de parceiro no cadastro (sem depender de PIX)

**STATUS: ✅ IMPLEMENTADO**

### O que foi feito

1. **Migration SQL** — Coluna `referred_by_partner_code TEXT` em `profiles` + trigger `handle_new_user` atualizado para salvar `partner_referral_code` do metadata
2. **`AuthContext.tsx`** — Campo `partner_referral_code` adicionado na interface `SignUpData` e no `options.data` do `signUp()`
3. **`Auth.tsx`** — Captura `getPartnerReferralCode()` no signup e inclui no `userData`; limpa localStorage após sucesso com `clearPartnerReferralTracking()`
4. **`AdminUserManagement.tsx`** — Fallback: se `partner_payment_intents` não tem sponsor, busca `profiles.referred_by_partner_code` e auto-preenche + valida
5. **`UserProfileCard.tsx`** — Fallback: busca `profiles.referred_by_partner_code` → contrato ativo com aquele código → exibe sponsor como "(Cadastro via link de parceiro)"
