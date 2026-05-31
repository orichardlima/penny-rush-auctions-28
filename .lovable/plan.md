## Objetivo
Fazer os botões de impersonação (👁️ / 🔑) aparecerem na aba **Admin → Parceiros → Contratos** para o super-admin `richardylima91@gmail.com`, corrigindo a validação no hook `useIsSuperAdmin`.

## Diagnóstico
O `system_settings.super_admin_user_id` está configurado corretamente (`a2e6092e-4621-4170-91d5-b68fbaa09ccd` = seu usuário), mas o hook `useIsSuperAdmin` está retornando `false`. A comparação atual feita no frontend é frágil (string vs UUID, possível trim/case, possível shape de retorno do `system_settings` diferente do esperado).

## Mudanças

### 1. `src/hooks/useIsSuperAdmin.ts`
- Substituir a leitura direta de `system_settings` + comparação manual por uma chamada à RPC já existente no banco: `is_super_admin(_user_id uuid)`.
- A RPC já é `SECURITY DEFINER` e usada em policies, então é a fonte única de verdade.
- Manter o mesmo shape de retorno (`boolean | null` enquanto carrega) para não quebrar `ImpersonateActions.tsx` nem a aba "Auditoria de Acessos".

```ts
const { data } = await supabase.rpc('is_super_admin', { _user_id: user.id });
setIsSuperAdmin(!!data);
```

### 2. Verificação
- Não altera UI, rotas, policies, nem nenhum outro fluxo administrativo.
- Confirmar no preview que, logado como `richardylima91@gmail.com`, em `/admin` → aba **Parceiros** → sub-aba **Contratos**, a coluna **Ações** mostra os botões azul (👁️ visualizar como) e âmbar (🔑 impersonar).
- Confirmar que a aba **Auditoria de Acessos** continua acessível.

## Fora de escopo
- Nenhuma mudança em RLS, migrations, edge functions, ou outras telas.
- Nenhuma mudança visual nos botões ou no layout da tabela de contratos.
