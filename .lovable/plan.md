

# Corrigir Taxa de Comissão de Afiliados

## Problema

A função `createAffiliateAccount` em `src/utils/affiliateHelpers.ts` usa `commission_rate: 10.00` hardcoded (linha 78), ignorando a configuração `affiliate_default_commission_rate` que o admin definiu como **50** no painel.

Além disso, todos os afiliados existentes já foram criados com `commission_rate = 10`.

## Alterações

### 1. `src/utils/affiliateHelpers.ts`

- Antes de inserir o registro, buscar `affiliate_default_commission_rate` da tabela `system_settings`
- Usar o valor retornado (fallback para 10 se não existir)
- Substituir o hardcoded `commission_rate: 10.00` pelo valor dinâmico

### 2. Atualizar afiliados existentes (SQL via insert tool)

- `UPDATE affiliates SET commission_rate = 50 WHERE commission_rate = 10`
- Corrige retroativamente todos os afiliados criados com taxa errada

### Nada mais alterado

- Nenhuma UI, webhook ou fluxo existente modificado
- Os webhooks já usam `affiliate.commission_rate` do banco, então ao corrigir o valor, as comissões passam a calcular corretamente

