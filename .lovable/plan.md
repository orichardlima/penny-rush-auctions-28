## Acesso administrativo às contas dos parceiros (impersonation)

Implementar **dois modos** de acesso restritos ao super-admin (apenas seu `user_id`), com motivo obrigatório e auditoria completa. Sem senha mestra.

---

### 1. Banco — nova tabela de auditoria

`admin_impersonation_log`:
- `admin_user_id`, `target_user_id`, `target_email`
- `mode` (`view_as` | `login_as`)
- `reason` (texto obrigatório)
- `ip_address`, `user_agent`
- `started_at`, `ended_at` (atualizado quando admin sai do modo)

RLS: somente o super-admin (verificação por `user_id` específico armazenado em `system_settings.super_admin_user_id`) pode inserir/ler. Tabela imutável (sem UPDATE/DELETE exceto `ended_at` pelo próprio admin).

Função `is_super_admin(uuid)` baseada em `system_settings` — separada de `is_admin_user` para não acoplar a `profiles.is_admin`.

### 2. Edge Function `admin-impersonate-user` (modo "Acessar como")

Fluxo:
1. Recebe `target_user_id` + `reason` (mínimo 10 caracteres).
2. Valida via JWT que o chamador é o super-admin (`is_super_admin`).
3. Busca o e-mail do alvo em `auth.users`.
4. Gera magic link com `supabase.auth.admin.generateLink({ type: 'magiclink', email })`.
5. Insere registro em `admin_impersonation_log` com IP/User-Agent.
6. Retorna a URL do magic link.

Nunca expõe senha do parceiro; nunca usa `service_role_key` no frontend.

### 3. Edge Function `admin-view-as-user` (modo "Ver como")

Mais simples:
1. Valida super-admin + motivo.
2. Registra em `admin_impersonation_log` com `mode='view_as'`.
3. Retorna um **snapshot** dos dados que o parceiro vê (perfil, contrato, saldo, rede binária, bônus, contratos, withdrawals, fury vault) consultados com `service_role` apenas para leitura.

Sem login; o admin permanece logado como ele mesmo.

### 4. Frontend — Painel admin

**Botões na lista de parceiros** (em `AdminPartnerManagement` ou tabela equivalente):
- 👁️ **Ver como** → abre dialog com os dados read-only do parceiro.
- 🔑 **Acessar como** → abre dialog pedindo motivo; ao confirmar, chama edge function e abre o magic link **em janela anônima nova** (`window.open(url, '_blank')`).

**Dialog de motivo** obrigatório em ambos os botões (textarea, mínimo 10 chars, ex: "ticket #1234 — verificar PIX bloqueado").

**Visibilidade dos botões**: só renderiza se `auth.uid() === super_admin_user_id` (consulta a `system_settings`).

**Banner global de impersonation**: quando o admin entra via magic link, o app detecta (flag em `localStorage` setada pela edge function via query param `?impersonating=1`) e mostra barra vermelha fixa no topo: *"⚠️ Você está acessando como [Nome]. [Sair da sessão]"*. Botão de saída chama `supabase.auth.signOut()` e marca `ended_at` no log.

### 5. Nova aba "Auditoria de Acessos" no painel admin

Componente `AdminImpersonationLogTab.tsx` listando todos os registros de `admin_impersonation_log` com:
- Data, admin, parceiro alvo, modo, motivo, IP, duração da sessão.
- Filtros por parceiro e período.

### Detalhes técnicos

```text
Fluxo "Acessar como":
[Admin clica] → dialog motivo → edge function valida + gera magic link
              → log INSERT → retorna URL → abre em nova aba
              → admin entra logado como parceiro
              → banner vermelho persistente + botão "sair"
```

- Super-admin definido por `system_settings.setting_key = 'super_admin_user_id'` (seed inicial = seu user_id).
- Magic link expira em 60s e é de uso único (config Supabase Auth padrão é suficiente).
- Toda chamada à edge function exige JWT válido + verificação dupla do `super_admin_user_id`.
- Logs são imutáveis após criados (RLS bloqueia UPDATE/DELETE).

### Fora de escopo
- Não criar senha mestra.
- Não alterar fluxo de login normal dos parceiros.
- Não tocar em RLS de outras tabelas — o admin entrando como parceiro herda automaticamente as permissões dele.
- Não alterar a tela `/minha-parceria` em si — apenas adicionar o banner condicional global.
