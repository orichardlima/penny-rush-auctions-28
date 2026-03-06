

## Plano: Adicionar edição de e-mail no modal AdminEditProfileDialog

### Problema
O modal "Editar Cadastro" do admin não possui campo para alterar o e-mail do usuário. Alterar e-mail exige atualizar tanto a tabela `auth.users` (via Admin API do Supabase) quanto a tabela `profiles`.

### Solução

**1. Nova Edge Function: `supabase/functions/admin-update-user-email/index.ts`**
- Mesmo padrão de verificação admin usado em `admin-update-user-password`
- Recebe `{ userId, newEmail }`
- Usa `supabaseAdmin.auth.admin.updateUserById(userId, { email: newEmail })` para atualizar `auth.users`
- Atualiza também `profiles.email` para manter sincronizado

**2. Editar `src/components/Admin/AdminEditProfileDialog.tsx`**
- Adicionar campo `email` no estado do formulário (pré-preenchido com a prop `userEmail`)
- Adicionar `Input` de "E-mail" entre "Nome Completo" e a linha CPF/Telefone
- No salvamento: se o e-mail mudou, chamar a nova Edge Function antes de atualizar o perfil
- Feedback de erro/sucesso adequado

### Nenhuma migração necessária
A coluna `profiles.email` já existe. A Edge Function usa a service role key para atualizar `auth.users`.

