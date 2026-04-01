

# Fix: Banner de Lançamento aparecendo mesmo desabilitado

## Causa raiz

A tabela `system_settings` tem RLS que permite leitura apenas para usuários **autenticados**. Usuários anônimos (não logados) recebem resultado vazio da query, o que faz o fallback `launch_banner_enabled: settings.launch_banner_enabled ?? true` retornar `true` — exibindo o banner mesmo estando desabilitado no banco.

## Correção

### `src/hooks/useLaunchBanner.ts`

- Linha 52: Alterar o fallback de `?? true` para `?? false`
  - Antes: `launch_banner_enabled: settings.launch_banner_enabled ?? true`
  - Depois: `launch_banner_enabled: settings.launch_banner_enabled ?? false`

Isso garante que, se a query falhar ou retornar vazio (seja por RLS, erro de rede, ou qualquer outro motivo), o banner **não** aparece por padrão. O banner só aparece quando explicitamente habilitado no banco de dados.

### Nenhuma outra alteração

- Nenhum componente, UI, tabela ou fluxo modificado

