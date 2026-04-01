

# Bloqueio Total para Parceiros Inadimplentes

## Resumo

Quando `financial_status !== 'paid'`, o parceiro deve ter **todas** as funcionalidades operacionais bloqueadas nos dois painéis (Parceiro e Afiliado), mantendo apenas visualização de dados.

## O que já está bloqueado

- Saques de parceiro e de afiliado
- Ativação de indicado por saldo
- Upgrade de plano
- Repasses semanais (Edge Function)
- Banner de alerta nos dois dashboards

## O que FALTA bloquear

### Painel do Parceiro (`PartnerDashboard.tsx`)

1. **Central de Anúncios** (tab `ads`) — bloquear envio de completions. Exibir alerta de bloqueio na `AdCenterDashboard`
2. **Encerramento Antecipado** — esconder o `PartnerEarlyTerminationDialog` para inadimplentes
3. **Link de indicação / Copiar / Compartilhar** — bloquear na `PartnerReferralSection` (desabilitar botão de copiar e compartilhar)

### Painel de Afiliado (`AffiliateDashboard.tsx`)

4. **Link de indicação** — desabilitar botões de copiar/compartilhar/QR Code
5. **Ferramentas** — bloquear funcionalidades na tab "Ferramentas"

## Alterações por arquivo

### `src/components/Partner/PartnerDashboard.tsx`
- Passar `isDefaulting` para `AdCenterDashboard` e `PartnerReferralSection`
- Esconder `PartnerEarlyTerminationDialog` quando inadimplente (já esconde upgrade)

### `src/components/Partner/AdCenterDashboard.tsx`
- Aceitar prop `isDefaulting?: boolean`
- Quando true: exibir alerta no topo e desabilitar botões de envio de completions

### `src/components/Partner/PartnerReferralSection.tsx`
- Aceitar prop `isDefaulting?: boolean`
- Quando true: desabilitar botão de copiar link e compartilhar, com mensagem de bloqueio

### `src/pages/AffiliateDashboard.tsx`
- Quando `partnerFinancialStatus !== 'paid'`: desabilitar botões de copiar/compartilhar link e QR Code
- Passar `isDefaulting` para componentes de ferramentas

## Não será alterado

- Nenhum dado será ocultado — apenas ações operacionais bloqueadas
- Nenhuma tabela, migration ou Edge Function alterada
- Fluxos de pagamento, webhooks e compra de lances permanecem intactos

