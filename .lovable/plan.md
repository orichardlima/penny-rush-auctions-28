## Diagnóstico

O erro `Edge Function returned a non-2xx status code` aconteceu porque o e-mail `pejigan.henrique@gmail.com` **já está cadastrado em outro usuário** (id `16f4accb-4686-4cc7-aac1-c9f4ddf50194`) no `auth.users`. O GoTrue rejeita a troca com erro genérico 500 (`unexpected_failure`) e a função `admin-update-user-email` repassa essa mensagem opaca para o frontend.

Ou seja: não é bug do sistema, é conflito de e-mail. Mas a mensagem precisa ser clara para o admin entender.

## O que será feito

1. **`supabase/functions/admin-update-user-email/index.ts`**
   - Antes de chamar `auth.admin.updateUserById`, verificar via `auth.admin.listUsers` (ou consulta a `profiles.email`) se já existe outro usuário com o e-mail informado.
   - Se existir e for um `userId` diferente do alvo → retornar `409` com mensagem: `"Este e-mail já está cadastrado para outro usuário."`
   - Manter todo o resto do fluxo intacto (validações, log, update de profile).

2. **`src/components/Admin/AdminEditProfileDialog.tsx`**
   - No `catch` do `invoke`, ler `emailResult?.error` e exibir a mensagem amigável quando vier do backend (já lê, mas garantir que o status 409 seja capturado — `supabase.functions.invoke` joga em `error` quando não é 2xx; o `data` pode vir vazio).
   - Ajustar para tentar ler o corpo do erro via `error.context?.body` quando `data` for `null`, mostrando a mensagem real ao invés do genérico.

## Como o admin resolve o caso atual

Para o Josué costa Andrade, o e-mail `pejigan.henrique@gmail.com` pertence a outro usuário. O admin precisa:
- Usar outro e-mail, **ou**
- Primeiro liberar o e-mail do outro usuário (16f4accb) trocando para outro valor, e depois aplicar aqui.

## Nada além disso será alterado

UI, layout, demais campos do dialog, e fluxo geral de edição permanecem idênticos.
