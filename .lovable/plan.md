

# Conclusão da Implementação: Restrições por Inadimplência

## O que já está implementado

- Campo `financial_status` no banco (`paid`, `pending_payment`, `overdue`)
- Admin pode alterar status manualmente com nota e auditoria
- Filtro por status financeiro no painel admin
- Badge visual na tabela de contratos e no PartnerDetailModal
- Banner de alerta no PartnerDashboard
- Edge Function `partner-weekly-payouts` filtra contratos inadimplentes

## O que falta implementar

### 1. Bloqueio de saques para inadimplentes
**Arquivo:** `src/components/Partner/PartnerWithdrawalSection.tsx`
- Verificar `financial_status` do contrato recebido via props
- Se `!= 'paid'`: desabilitar botão de saque, exibir mensagem "Saques bloqueados por pendência financeira"

### 2. Bloqueio de ativação de indicados (SponsorActivate)
**Arquivo:** `src/components/Partner/PartnerReferralSection.tsx`
- Passar `financial_status` do contrato para o componente
- Se `!= 'paid'`: desabilitar botão "Ativar Indicado" com tooltip explicativo

**Arquivo:** `src/components/Partner/SponsorActivateDialog.tsx`
- Adicionar prop `disabled` e mensagem de bloqueio

### 3. Bloqueio de upgrade de plano
**Arquivo:** `src/components/Partner/PartnerDashboard.tsx`
- Condicionar exibição do `PartnerUpgradeDialog`: só mostrar se `financial_status === 'paid'`

### 4. Incluir `financial_status` na interface `PartnerContract`
**Arquivo:** `src/hooks/usePartnerContract.ts`
- Adicionar `financial_status` à interface `PartnerContract`
- Incluir campo na query de busca do contrato
- Eliminar uso de `(contract as any).financial_status` no Dashboard

### 5. Geração de link/QR de pagamento no banner
**Arquivo:** `src/components/Partner/PartnerDashboard.tsx`
- Adicionar botão "Pagar agora" no banner que redireciona para o fluxo de pagamento (invocar `partner-payment` para gerar QR Code PIX)
- Abrir o `PartnerPixPaymentModal` com os dados de pagamento

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/usePartnerContract.ts` | Adicionar `financial_status` à interface e query |
| `src/components/Partner/PartnerDashboard.tsx` | Remover `as any`, bloquear upgrade, botão "Pagar agora" no banner |
| `src/components/Partner/PartnerWithdrawalSection.tsx` | Bloquear saques se inadimplente |
| `src/components/Partner/PartnerReferralSection.tsx` | Bloquear ativação de indicados |
| `src/components/Partner/SponsorActivateDialog.tsx` | Prop de bloqueio |

## Não será alterado

- Nenhum fluxo de pagamento, webhook ou compra de lances existente
- Nenhuma tabela ou migration (tudo já existe no banco)
- Painel admin (já completo)

