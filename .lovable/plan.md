

# Bloquear Painel de Afiliados para Parceiros Inadimplentes

## Resumo

Adicionar verificação de `financial_status` do `partner_contracts` no painel de afiliados. Parceiros inadimplentes verão um banner de alerta e terão saques bloqueados, mas poderão visualizar todos os dados.

## Alterações

### 1. `src/pages/AffiliateDashboard.tsx`

- Após carregar `affiliateData`, buscar o `financial_status` do `partner_contracts` do usuário (contrato ACTIVE com plano Legend)
- Criar estado `partnerFinancialStatus` (default `'paid'`)
- Adicionar query:
  ```ts
  const { data: contract } = await supabase
    .from('partner_contracts')
    .select('financial_status')
    .eq('user_id', profile.user_id)
    .eq('status', 'ACTIVE')
    .single();
  ```
- Renderizar banner de alerta (amarelo/vermelho) no topo do conteúdo principal quando `financialStatus !== 'paid'`
- Passar prop `isDefaulting={financialStatus !== 'paid'}` para `AffiliateWithdrawalSection`

### 2. `src/components/Affiliate/AffiliateWithdrawalSection.tsx`

- Adicionar prop `isDefaulting?: boolean` na interface
- Quando `isDefaulting === true`:
  - Desabilitar botão "Solicitar Saque" com mensagem explicativa
  - Manter visualização do histórico de saques normalmente

### Não será alterado

- Nenhum outro componente, hook, tabela ou fluxo existente
- Dados continuam visíveis (links, comissões, indicados, analytics)
- Apenas ações financeiras (saques) são bloqueadas

