

## Plano: Vincular patrocinador de parceiro no cadastro (sem depender de PIX)

**STATUS: ✅ IMPLEMENTADO**

### O que foi feito

1. **Migration SQL** — Coluna `referred_by_partner_code TEXT` em `profiles` + trigger `handle_new_user` atualizado para validar `partner_referral_code` contra `partner_contracts` ativos antes de salvar
2. **`AuthContext.tsx`** — Campo `partner_referral_code` adicionado na interface `SignUpData` e no `options.data` do `signUp()`
3. **`Auth.tsx`** — No signup, diferencia se `?ref=` é de parceiro ou afiliado (consulta `partner_contracts`), e envia apenas no campo correto. Limpa ambos os localStorage após sucesso.
4. **`AdminUserManagement.tsx`** — Fallback: se `partner_payment_intents` não tem sponsor, busca `profiles.referred_by_partner_code` e auto-preenche + valida
5. **`UserProfileCard.tsx`** — Fallback: busca `profiles.referred_by_partner_code` → contrato ativo com aquele código → exibe sponsor como "(Cadastro via link de parceiro)"

### Tratamento da sobreposição `?ref=`
- No frontend (Auth.tsx): antes do signup, o código é verificado contra `partner_contracts`. Se encontra match ativo → `partner_referral_code`. Senão → `referral_code` (afiliado).
- No trigger (handle_new_user): `partner_referral_code` só é salvo em `profiles.referred_by_partner_code` se validado contra um contrato ativo. Código inexistente/inativo é descartado com log.
