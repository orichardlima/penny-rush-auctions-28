
# Corrigir query do usePartnerContract para priorizar contratos ACTIVE

## Problema

Quando um usuario tem multiplos contratos (ex: tentativas de pagamento que geraram contratos SUSPENDED), a query atual busca apenas o mais recente por `created_at`. Se o mais recente for SUSPENDED, o usuario ve "Suspenso" mesmo tendo um contrato ACTIVE anterior.

## Alteracoes

### 1. `src/hooks/usePartnerContract.ts` - fetchContract (linhas 131-137)

Alterar a query para buscar primeiro um contrato ACTIVE. Se nao encontrar, buscar o mais recente (qualquer status).

Logica:
1. Primeiro tenta: `WHERE user_id = X AND status = 'ACTIVE' LIMIT 1`
2. Se nao encontrar: `WHERE user_id = X ORDER BY created_at DESC LIMIT 1` (comportamento atual como fallback)

### 2. `src/pages/Dashboard.tsx` - checkPartnerContract (linhas 28-33)

Esta query ja filtra por `status = 'ACTIVE'`, entao nao precisa de alteracao.

### O que NAO muda

- Nenhuma tabela ou coluna no banco de dados
- Nenhum outro componente ou hook
- Logica de payouts, upgrades, Central de Anuncios
- Interface visual do dashboard do parceiro
