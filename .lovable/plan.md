
O usuário relata não conseguir logar como admin e suspeita de alteração no banco ou ataque. Os logs do console mostram claramente o problema:

```
AuthRetryableFetchError ... status: 503
```

O **status 503** indica que o serviço de autenticação do Supabase (GoTrue) está temporariamente indisponível — não é ataque nem alteração no banco. Confirmei com os logs de auth que **outro login do mesmo usuário (`sociedade@gmail.com` — warlley silva) ocorreu com sucesso às 16:04:18Z** (`status: 200`), o que descarta corrupção do profile/conta.

Vou investigar:
1. Tabela `admin_audit_log` para mudanças recentes em usuários/admins.
2. Histórico de logins do admin afetado nos últimos dias.
3. Migrações recentes que alteraram `profiles`, `auth` ou políticas RLS.
4. Conferir se há sinais de comprometimento (criação de admins novos, alterações em massa).

## Plano de investigação

### 1. Auditoria do banco (read-only)
- Consultar `admin_audit_log` (últimas 48h) — qualquer ação suspeita de criação de admin, alteração de senha, exclusão de usuário.
- Verificar `profiles` com `is_admin = true` — listar todos os admins atuais e comparar com a expectativa do usuário.
- Conferir últimas atualizações em `profiles` (`updated_at` recente) com flags sensíveis (`is_admin`, `is_blocked`).
- Listar migrações SQL aplicadas nas últimas 72h (pasta `supabase/migrations/`) — identificar se alguma alterou autenticação/RLS.

### 2. Logs de autenticação
- Já confirmado: login bem-sucedido às 16:04:18Z para `sociedade@gmail.com`.
- Vou checar tentativas falhadas (`/token` com status 4xx/5xx) nas últimas 2h para identificar padrão de ataque (brute-force).

### 3. Diagnóstico do erro 503 atual
- O erro `AuthRetryableFetchError status 503` no console indica indisponibilidade temporária do endpoint Supabase Auth (`/auth/v1/user` e `/auth/v1/token`).
- Causa típica: instabilidade momentânea do GoTrue / rate limit / cold start. **Não é ataque.**
- Confirmar consultando os logs da plataforma de auth e o status atual.

### 4. Apresentar diagnóstico final
Após coletar evidências, retornar um relatório com:
- ✅ / ❌ Sinais de ataque
- ✅ / ❌ Alterações suspeitas no banco
- Causa real do problema de login (provavelmente 503 transitório)
- Recomendações: tentar novamente, conferir Status do Supabase, e — se persistir — possível troca de senha e revisão de admins.

### Arquivos / ações
- Apenas consultas SQL read-only e leitura de logs.
- **Nenhuma alteração de código ou banco será feita nesta etapa.**
- Caso identifique comprometimento real, apresentarei novo plano com correções (revogação de admins indevidos, força de logout global, rotação de chaves).
