## Objetivo

Permitir login/cadastro via Google em `/auth`, preservando todas as regras do projeto: CPF obrigatório, endereço, código de indicação de parceiro (`partner_referral_code`) e código de afiliado (`referral_code`).

---

## Configuração externa (você faz — manual)

Sem essas duas etapas o botão não funciona:

1. **Google Cloud Console** → criar OAuth Client ID (Web application)
   - Authorized JavaScript origins: `https://testeleilao.site`, `https://showdelances.com`, `https://penny-rush-auctions-28.lovable.app`, `https://id-preview--a9bdfc06-a96f-4acd-9270-1da71c1988cb.lovable.app`, `http://localhost:3000`
   - Authorized redirect URI: `https://tlcdidkkxigofdhxnzzo.supabase.co/auth/v1/callback`
2. **Supabase Dashboard** → Authentication → Providers → Google → habilitar e colar Client ID + Client Secret. Em URL Configuration, garantir Site URL e Redirect URLs com os domínios acima.

Eu te entrego um passo a passo printável quando você for executar.

---

## Mudanças no app

### 1. Banco de dados (1 migration)

- Adicionar coluna `profile_complete BOOLEAN DEFAULT false` em `public.profiles` (já marcamos como `true` para todos os registros existentes para não afetar usuários atuais).
- Ajustar `handle_new_user()`:
  - Detectar provider Google via `NEW.raw_app_meta_data->>'provider' = 'google'`.
  - Quando vier do Google: criar profile mínimo (email, full_name do Google), CPF/telefone/endereço ficam nulos, `profile_complete = false`.
  - Quando vier do cadastro tradicional (email/senha): comportamento atual + `profile_complete = true`.
  - Continuar processando `partner_referral_code` e `referral_code` (afiliado) que vierem via `raw_user_meta_data` — funcionará tanto no fluxo email quanto Google (vamos enviar via `queryParams`/metadata antes do redirect).

### 2. Frontend — `/auth` (`src/pages/Auth.tsx`)

- Adicionar botão **"Continuar com Google"** acima do formulário, em ambas as abas (Login e Cadastro), com divisor "ou".
- Antes do redirect, salvar no `localStorage`:
  - `pending_partner_ref` (se houver `?ref=` ou `?partner_ref=` na URL ou já em cache)
  - `pending_affiliate_ref` (se houver código de afiliado ativo na URL)
- Chamar:
  ```
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  })
  ```

### 3. Nova rota `/auth/callback` (`src/pages/AuthCallback.tsx`)

- Recebe o retorno do Google, aguarda a sessão pelo `onAuthStateChange`.
- Lê códigos de indicação do `localStorage` e, se existirem, faz `supabase.auth.updateUser({ data: { partner_referral_code, referral_code } })` e dispara uma RPC `apply_pending_referrals_to_profile()` (criada na mesma migration) que reaproveita a lógica de validação/processamento de indicação para usuários Google.
- Limpa `localStorage` e redireciona para `/complete-profile` se `profile_complete = false`; senão para `/dashboard`.

### 4. Nova rota `/complete-profile` (`src/pages/CompleteProfile.tsx`)

- Form obrigatório com: CPF (validado e único), telefone, data de nascimento, CEP + autopreenchimento, número, complemento, código de indicação (pré-preenchido do localStorage, editável).
- Reusa os mesmos validators (`formatCPF`, `formatPhone`, `formatCEP`, `fetchAddressByCEP`) e o `useFieldValidation` (checa CPF duplicado).
- Ao salvar: `UPDATE profiles SET ..., profile_complete = true` e, se preencheram `partner_referral_code`, reusa a mesma validação do trigger via RPC.

### 5. Guard global de perfil incompleto

- No `AuthContext`/wrapper de rotas autenticadas: se `profile_complete = false` e a rota atual não for `/complete-profile`, `/auth/callback` ou logout, redirecionar para `/complete-profile`. Bloqueia acesso a Dashboard, leilões, checkout, parceiro, etc., até o usuário completar.

### 6. Reaproveitamento do código de indicação

- O hook que hoje lê `?ref=` da URL e guarda no `localStorage` (já existe para o checkout) é o mesmo a ser usado antes do redirect Google — sem nova lógica de tracking.

---

## Pontos técnicos importantes

- **Sem nova tabela.** Apenas uma coluna em `profiles`.
- **Sem mudança em pagamentos, leilões, rede binária ou parceria.** Toda a regra existente (`payer_cannot_be_referrer`, validação do `partner_referral_code`, bônus de cadastro) continua igual; ela é executada via `handle_new_user` ou via RPC pós-complete-profile.
- **Backfill seguro:** todos os profiles atuais recebem `profile_complete = true`, ninguém é forçado para `/complete-profile` indevidamente.
- **Conflito de e-mail:** se um e-mail já existe com cadastro por senha e o usuário entra com Google do mesmo e-mail, o Supabase associa as identidades automaticamente (mesmo `user_id`), e o `profile_complete` continuará `true` — sem duplicidade.
- **Risco de abuso:** como o usuário só consegue dar lance / contratar plano / sacar após preencher CPF, não há janela para fraude com conta Google "vazia".

---

## Entregáveis

```text
supabase/migrations/<timestamp>_google_oauth_profile_complete.sql
src/pages/Auth.tsx                  (adicionar botão Google)
src/pages/AuthCallback.tsx          (novo)
src/pages/CompleteProfile.tsx       (novo)
src/contexts/AuthContext.tsx        (expor profile_complete + guard)
src/App.tsx                         (registrar rotas /auth/callback e /complete-profile)
```

Quando aprovar, eu implemento e te mando junto o passo a passo do Google Cloud + Supabase.
