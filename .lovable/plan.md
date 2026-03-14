

# Plano de Implementação — Todas as Melhorias

Este plano cobre 4 frentes: Segurança (P0), Negócio (P2), Arquitetura (P2) e Performance (P3). Será executado em etapas sequenciais.

---

## Etapa 1 — Correções de Segurança Críticas (P0)

### 1.1 Proteger `profiles` contra escalação de privilégio

Criar um trigger `BEFORE UPDATE` na tabela `profiles` que impede qualquer usuário (exceto service_role) de alterar `is_admin`, `is_blocked` e `bids_balance`:

```sql
CREATE OR REPLACE FUNCTION protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := OLD.is_blocked;
    NEW.bids_balance := OLD.bids_balance;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_sensitive_fields
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_fields();
```

### 1.2 Restringir dados públicos em `profiles`

Substituir a policy `Public can view profile names` (USING: true) por duas policies:
- Próprio usuário e admins veem tudo
- Público vê apenas `full_name` e `avatar_url` via função SECURITY DEFINER

```sql
DROP POLICY IF EXISTS "Public can view profile names" ON profiles;

-- Usuário vê seu próprio perfil completo
CREATE POLICY "Users can view own full profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins veem tudo
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_admin_user(auth.uid()));
```

Para buscas públicas (ex: nome do vencedor), criar uma função SECURITY DEFINER que retorna apenas `full_name` e `avatar_url`.

### 1.3 Proteger `partner_contracts` contra auto-modificação financeira

Substituir a policy de UPDATE para restringir campos modificáveis:

```sql
DROP POLICY IF EXISTS "Users can update their own contracts" ON partner_contracts;

CREATE POLICY "Users can update own contract payment info"
ON partner_contracts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = OLD.status
  AND available_balance = OLD.available_balance
  AND total_received = OLD.total_received
  AND total_withdrawn = OLD.total_withdrawn
  AND total_cap = OLD.total_cap
  AND weekly_cap = OLD.weekly_cap
  AND aporte_value = OLD.aporte_value
);
```

Como `OLD` não funciona em WITH CHECK, usaremos um trigger BEFORE UPDATE similar ao de profiles para proteger campos financeiros.

### 1.4 Proteger `affiliates` contra auto-atribuição de role

Atualizar a policy de INSERT:

```sql
DROP POLICY IF EXISTS "Users can insert their own affiliate account" ON affiliates;

CREATE POLICY "Users can insert own affiliate account"
ON affiliates FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'affiliate'
  AND status = 'pending'
);
```

### 1.5 Fixar `search_path` nas funções existentes

Alterar as funções `is_admin_user`, `get_user_affiliate_id`, `is_affiliate_manager` e outras para incluir `SET search_path = public`.

---

## Etapa 2 — Funcionalidades de Negócio (P2)

### 2.1 Afiliado automático no cadastro

Modificar o trigger `handle_new_user` (ou criar um novo trigger AFTER INSERT em `profiles`) para inserir automaticamente um registro em `affiliates` com código único gerado e `status = 'active'`.

### 2.2 Ativar comissão de recompra

Inserir na tabela `system_settings` os registros:
- `affiliate_repurchase_enabled` = `true`
- `affiliate_repurchase_commission_rate` = `10`

---

## Etapa 3 — Refatoração de Arquitetura (P2)

### 3.1 Dividir `AdminDashboard.tsx` (1.834 linhas)

Extrair em sub-componentes por aba:
- `AdminDashboard/AuctionManagement.tsx` — gestão de leilões
- `AdminDashboard/UserManagement.tsx` — gestão de usuários
- `AdminDashboard/FinancialOverview.tsx` — visão financeira
- `AdminDashboard/SystemConfig.tsx` — configurações

O `AdminDashboard.tsx` ficará como orquestrador com `<Tabs>` e importações lazy.

---

## Etapa 4 — Performance (P3)

### 4.1 Lazy loading para rotas principais

Converter `Dashboard`, `Auth`, `Auctions`, `BidPackagesPage` e `Winners` para `lazy()` em `App.tsx`. Manter `Index` eager (landing page).

### 4.2 Configurar QueryClient com cache

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});
```

---

## Ordem de Execução

1. Migração SQL com todos os fixes de segurança (triggers + policies)
2. Criar função pública para busca de nomes (substituir leituras públicas de profiles)
3. Inserir dados em system_settings (recompra)
4. Modificar trigger handle_new_user (afiliado automático)
5. Refatorar AdminDashboard em sub-componentes
6. Aplicar lazy loading e cache no frontend

**Impacto**: Fecha 4 vulnerabilidades críticas, ativa receita recorrente via recompras, melhora manutenibilidade e velocidade de carregamento.

