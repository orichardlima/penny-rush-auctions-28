

# Exibir Nome do Indicado na Tabela de Comissões

## Problema

Na aba "Comissões" do painel de afiliados admin, a coluna "Indicado" mostra apenas `Usuário #xxxx` (trecho do UUID) em vez do nome real do usuário indicado.

## Solução

### 1. `src/hooks/useAdminAffiliates.ts` — Buscar nomes dos indicados

Na função `fetchCommissions`, após buscar os affiliates e seus profiles, também buscar os profiles dos `referred_user_id`:

- Coletar todos os `referred_user_id` únicos das comissões
- Fazer query em `profiles` com `.in('user_id', referredUserIds)` para obter os nomes
- Adicionar campo `referred_profile: { full_name }` ao objeto da comissão mapeada

### 2. `src/hooks/useAdminAffiliates.ts` — Atualizar interface `Commission`

Adicionar campo opcional `referred_profile?: { full_name: string }` à interface.

### 3. `src/components/AdminAffiliateManagement.tsx` — Exibir nome real

Linha 728: trocar `Usuário #{commission.referred_user_id.substring(0, 8)}` por `commission.referred_profile?.full_name || 'Usuário desconhecido'`.

### Nenhum outro arquivo alterado

