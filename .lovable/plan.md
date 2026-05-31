## Objetivo
Fazer o botão “Acessar como parceiro” funcionar sem retornar `Edge Function returned a non-2xx status code`.

## O que vou fazer
1. **Restaurar a publicação da função `admin-impersonate-user`**
   - Ajustar a implementação da Edge Function para seguir o mesmo padrão das funções já ativas no projeto.
   - Garantir que ela seja reconhecida e publicada no Supabase, porque hoje a rota está retornando `404 NOT_FOUND`.

2. **Validar a lógica do fluxo `login_as`**
   - Confirmar que a função:
     - valida o super-admin corretamente,
     - grava em `admin_impersonation_log`,
     - busca o usuário alvo,
     - gera o link de acesso sem falhar.
   - Se houver incompatibilidade de runtime/deploy, adaptar imports/config para o padrão estável usado nas outras Edge Functions do projeto.

3. **Testar o retorno esperado no frontend**
   - Verificar que `ImpersonateActions.tsx` volta a receber resposta 2xx.
   - Confirmar que o toast de erro desaparece e o fluxo de abertura do link funciona.

## Diagnóstico encontrado
- A tabela e as policies de `admin_impersonation_log` existem.
- O super-admin já foi corrigido no `system_settings`.
- O erro atual não é mais de permissão do botão.
- A chamada para a Edge Function `/admin-impersonate-user` está retornando **404**, indicando que a função existe no código, mas **não está publicada/ativa** no projeto.
- Não encontrei logs recentes da função no Supabase, o que reforça que ela não chegou a ser executada.

## Detalhes técnicos
- Arquivo da função: `supabase/functions/admin-impersonate-user/index.ts`
- Ponto do frontend que chama a função: `src/components/Admin/ImpersonateActions.tsx`
- Migration da auditoria: `supabase/migrations/20260531150526_5e238037-4132-4c2e-a900-c5db8159e12e.sql`
- Se o deploy estiver falhando por compatibilidade do runtime, vou alinhar imports/config com o padrão das outras funções do projeto e então republicar/testar a função.

## Resultado esperado
- O botão `🔑` deixa de mostrar erro.
- O acesso como parceiro gera o link corretamente.
- O fluxo continua restrito apenas ao super-admin, sem alterar outras áreas do sistema.