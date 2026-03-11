

## Plano: Vincular patrocinador de parceiro no cadastro (sem depender de PIX)

### Problema
O código de indicação de parceiro (`?ref=CODE`) é salvo apenas no `localStorage`. Só é persistido no banco quando o usuário gera um PIX (`partner_payment_intents`). Se nunca gera PIX, o admin não vê o patrocinador.

### Solução

**1. Migration SQL — Nova coluna + atualização do trigger**
- Adicionar `referred_by_partner_code TEXT` na tabela `profiles`
- Atualizar `handle_new_user()` para copiar `partner_referral_code` do `raw_user_meta_data` para `profiles.referred_by_partner_code`

**2. `src/pages/Auth.tsx` — Capturar código de parceiro no signup**
- Importar `getPartnerReferralCode` de `usePartnerReferralTracking`
- Na `handleBettorContractAccept`, ler o código e incluir no `userData` como `partner_referral_code`
- Após sucesso, chamar `clearPartnerReferralTracking()` junto com `clearReferralTracking()`

**3. `src/contexts/AuthContext.tsx` — Passar no metadata**
- Adicionar `partner_referral_code` (opcional) na interface `SignUpData`
- Incluir no `options.data` do `supabase.auth.signUp()`

**4. `src/components/AdminUserManagement.tsx` — Fallback na busca de sponsor**
- Após busca em `partner_payment_intents` (linhas 322-347), se não encontrou sponsor:
  - Buscar `profiles.referred_by_partner_code` do usuário
  - Se encontrar um código, buscar contrato ativo com aquele `referral_code`
  - Auto-preencher e validar

**5. `src/components/UserProfileCard.tsx` — Fallback na exibição de origem**
- Após o fallback atual de `partner_payment_intents` (linha 93-117), se ainda não encontrou referrer:
  - Buscar `profiles.referred_by_partner_code` do usuário
  - Se encontrar, buscar contrato ativo com aquele código → exibir sponsor como "(Cadastro via link de parceiro)"

### Arquivos afetados
| Arquivo | Alteração |
|---|---|
| Nova migration SQL | Coluna `referred_by_partner_code` + trigger `handle_new_user` |
| `src/pages/Auth.tsx` | Capturar e enviar partner referral code no signup |
| `src/contexts/AuthContext.tsx` | Campo `partner_referral_code` no SignUpData e metadata |
| `src/components/AdminUserManagement.tsx` | Fallback para `profiles.referred_by_partner_code` |
| `src/components/UserProfileCard.tsx` | Fallback para exibir sponsor via código salvo na profile |

