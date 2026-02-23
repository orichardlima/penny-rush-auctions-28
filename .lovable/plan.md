

# Repasses automaticamente disponiveis para saque (sem aprovacao admin)

## Situacao Atual

O fluxo atual exige que o administrador aprove manualmente cada repasse semanal (mudando de PENDING para PAID) antes que o parceiro possa solicitar saque. Isso e lento e desnecessario, pois os repasses sao calculados automaticamente com base no faturamento real.

```text
Cron gera repasse (PENDING) --> Admin aprova (PAID) --> Parceiro solicita saque --> Admin paga
```

## Nova Abordagem

Os repasses serao gerados diretamente como PAID, ficando imediatamente disponiveis para saque. O admin apenas aprova/processa o saque final (transferencia PIX).

```text
Cron gera repasse (PAID) --> Parceiro solicita saque --> Admin paga saque
```

## Mudancas Necessarias

### 1. Edge Function `partner-weekly-payouts/index.ts`
- Linha 342: Alterar `status: 'PENDING'` para `status: 'PAID'`
- Adicionar `paid_at: new Date().toISOString()` no insert do payout

### 2. Dashboard do Parceiro `src/components/Partner/PartnerDashboard.tsx`
- Remover referencias ao status "Pendente" nos cards de resumo de repasses
- Remover o filtro "Pendentes" da lista de repasses
- Ajustar os totais para nao separar entre "Pago" e "Pendente" (tudo sera "Creditado")

### 3. Admin Partner Management `src/components/Admin/AdminPartnerManagement.tsx`
- Remover botoes "Aprovar" e "Cancelar" dos repasses (nao faz mais sentido aprovar)
- Manter a visualizacao dos repasses apenas como historico informativo

### 4. Hook `src/hooks/useAdminPartners.ts`
- Remover ou simplificar funcao de aprovar/cancelar repasses (approvePayouts, cancelPayouts)
- Remover contagem de "pendingPayouts" do summary

### 5. Cashflow Dashboard `src/hooks/usePartnerCashflow.ts`
- Unificar `totalPayoutsPaid` e `totalPayoutsPending` em um unico total
- Remover separacao de status nos calculos

### 6. Analytics Charts `src/components/Admin/PartnerAnalyticsCharts.tsx`
- Remover separacao entre "pendingAmount" e "paidAmount" nos graficos

### 7. Hook de Saldo `src/hooks/usePartnerWithdrawals.ts`
- Nenhuma mudanca necessaria: ja calcula saldo baseado em payouts com status PAID, que agora serao todos

## O que NAO muda

- Interface de saques (PartnerWithdrawalSection) permanece identica
- Fluxo de aprovacao de saques pelo admin continua igual
- Calculo de rendimentos, pro rata, tetos e Central de Anuncios permanecem inalterados
- Bonus de indicacao e bonus binario continuam com fluxo proprio
- Todas as demais telas e funcionalidades permanecem intactas

## Secao Tecnica

**Arquivos modificados:**
1. `supabase/functions/partner-weekly-payouts/index.ts` - status PENDING -> PAID
2. `src/components/Partner/PartnerDashboard.tsx` - remover UI de pendentes
3. `src/components/Admin/AdminPartnerManagement.tsx` - remover botoes aprovar/cancelar repasse
4. `src/hooks/useAdminPartners.ts` - remover logica de aprovacao de repasses
5. `src/hooks/usePartnerCashflow.ts` - simplificar calculo
6. `src/components/Admin/PartnerAnalyticsCharts.tsx` - simplificar graficos

**Dados existentes:** Os repasses ja gerados com status PENDING precisarao ser atualizados para PAID via SQL (UPDATE) para ficarem disponiveis retroativamente.

