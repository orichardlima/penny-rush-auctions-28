

## Plano: Mostrar indicação de parceiro mesmo antes do pagamento

### Problema
O usuário Abraão se cadastrou usando o código de indicação `Y0N62SC9` de **Luiz Claudio Macedo dos Santos**. Porém a seção "Indicado por" mostra "Cadastro direto (sem indicação)" porque:

1. A query atual só verifica `affiliate_referrals` (não existe registro — o código é de parceiro, não de afiliado)
2. A query atual só verifica `partner_contracts` (não existe — Abraão ainda não pagou)
3. **Existe** um registro em `partner_payment_intents` com `referred_by_user_id` apontando para Claudio Macedo e `referral_code = Y0N62SC9`, mas essa tabela não é consultada
4. **Existe** o código `Y0N62SC9` salvo em `auth.users.raw_user_meta_data.referral_code`, mas também não é consultado

### Correção

No `UserProfileCard.tsx`, adicionar uma terceira verificação na query de referral:

**Após** checar `affiliate_referrals` e `partner_contracts`, consultar também `partner_payment_intents` onde `user_id = userId` e `referred_by_user_id IS NOT NULL`, para capturar indicações de parceiros cujo pagamento ainda está pendente.

Se encontrar, buscar o nome do indicador via `profiles` e exibir como: **"Luiz Claudio Macedo dos Santos"** (Parceria pendente de pagamento) com a data.

### Arquivo impactado
- `src/components/UserProfileCard.tsx` — adicionar consulta a `partner_payment_intents` como fallback quando não há `partner_contracts`

