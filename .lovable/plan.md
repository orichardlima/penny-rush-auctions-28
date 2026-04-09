

# Ajuste manual de saldo unificado (Afiliado + Parceiro)

## Conceito

Criar uma interface unificada no painel admin onde, ao ajustar saldo de um usuário, o administrador seleciona o destino: **carteira de afiliado** ou **carteira de parceiro**. Isso centraliza a operação em um único fluxo.

## Situação atual

- **Parceiro**: Já existe sistema completo (`partner_manual_credits`, função `addManualCredit` no `useAdminPartners.ts`, UI no painel de parceiros). Funciona bem.
- **Afiliado**: Não existe sistema de crédito manual. O `commission_balance` só muda via comissões automáticas.

## Alterações

### 1. Migration: Tabela `affiliate_manual_credits` + RPC

**Tabela `affiliate_manual_credits`**:
| Coluna | Tipo |
|---|---|
| id | uuid PK |
| affiliate_id | uuid FK |
| amount | numeric (positivo ou negativo) |
| reason | text NOT NULL |
| created_by | uuid |
| created_at | timestamptz |

RLS: apenas admins (INSERT, SELECT).

**RPC `admin_adjust_affiliate_balance`** (SECURITY DEFINER):
1. Valida que o chamador é admin
2. Insere registro em `affiliate_manual_credits`
3. Atualiza `affiliates.commission_balance` (soma) e `total_commission_earned` (se positivo)
4. Insere entrada no `admin_audit_log`
5. Retorna novo saldo

### 2. `useAdminAffiliates.ts` — nova função `adjustBalance`

Chama a RPC `admin_adjust_affiliate_balance` e atualiza estado local.

### 3. `AdminAffiliateManagement.tsx` — botão + dialog de ajuste

Na tabela de afiliados, adicionar ícone de carteira. Ao clicar, abre dialog com:
- Nome do afiliado e saldo atual
- **Seletor de destino**: "Carteira Afiliado" ou "Carteira Parceiro"
  - Se escolher "Parceiro", busca o contrato ativo do mesmo `user_id` e usa o sistema existente (`addManualCredit`)
  - Se escolher "Afiliado", usa a nova RPC
  - Se o usuário não tiver conta no destino escolhido, mostra mensagem de erro
- Campo de valor (aceita negativo para débito)
- Campo de justificativa obrigatória
- Para destino "Parceiro": checkbox "Consome teto?" (já existe no sistema de parceiros)

### 4. Também acessível pelo painel de parceiros

No `AdminPartnerManagement`, o dialog de crédito manual existente ganha o mesmo seletor de destino, permitindo redirecionar para a carteira de afiliado se o admin preferir.

## Fluxo

1. Admin acessa gestão de afiliados (ou parceiros)
2. Clica no ícone de carteira de um usuário
3. Escolhe destino: "Afiliado" ou "Parceiro"
4. Sistema valida se o usuário tem conta no destino
5. Preenche valor + justificativa → confirma
6. Operação executa atomicamente com auditoria

## Arquivos alterados

- `supabase/migrations/` — 1 migration (tabela + RPC)
- `src/hooks/useAdminAffiliates.ts` — nova função `adjustBalance`
- `src/components/AdminAffiliateManagement.tsx` — botão + dialog com seletor de destino
- `src/hooks/useAdminPartners.ts` — expor `addManualCredit` para uso cruzado (já existe, apenas garantir export)

