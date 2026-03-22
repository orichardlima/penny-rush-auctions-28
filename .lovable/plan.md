

# Funcionalidade de Saque para Afiliados

## Resumo

Criar um sistema completo de saque para afiliados, reutilizando padrões já existentes no sistema de parceiros (`PartnerWithdrawalSection`). A tabela `affiliate_withdrawals` já existe com RLS configurado.

## Arquivos a criar/modificar

### 1. Novo: `src/hooks/useAffiliateWithdrawals.ts`

Hook dedicado para gerenciar saques de afiliados:
- `fetchWithdrawals()` — lista saques do afiliado
- `requestWithdrawal(amount, pixKey, pixKeyType, holderName)` — insere na `affiliate_withdrawals`
- `calculateAvailableBalance()` — `commission_balance` do afiliado (já calculado pelo sistema)
- Validação de saldo mínimo buscando `affiliate_min_withdrawal` da tabela `system_settings`
- Validação de saque pendente (não permitir novo se já existe um `pending`)

### 2. Novo: `src/components/Affiliate/AffiliateWithdrawalSection.tsx`

Componente com:
- Card de saldo disponível (usa `commission_balance` do affiliateData)
- Card de dados PIX (cadastro/edição da chave PIX — salva em `affiliates.pix_key` e `affiliates.bank_details`)
- Botão "Solicitar Saque" com dialog (valor + dados PIX)
- Tabela de histórico de saques com status (Pendente/Pago/Rejeitado)
- Validação: saldo mínimo, saque pendente existente

### 3. Modificar: `src/pages/AffiliateDashboard.tsx`

- Adicionar nova tab "Saques" (ícone Wallet) no TabsList
- Ajustar grid-cols (4→5 sem manager, 5→6 com manager)
- Importar e renderizar `AffiliateWithdrawalSection` na nova tab

### 4. Migration SQL: adicionar setting de saldo mínimo

```sql
INSERT INTO system_settings (key, value, description)
VALUES ('affiliate_min_withdrawal', '50', 'Valor mínimo para saque de afiliado (R$)')
ON CONFLICT (key) DO NOTHING;
```

## Detalhes técnicos

- O saldo disponível é `affiliateData.commission_balance` (já mantido pelo sistema de comissões)
- Ao solicitar saque, o status é `pending` (diferente do parceiro que vai direto para `approved`)
- A chave PIX é salva na coluna `affiliates.pix_key` e `affiliates.bank_details` (já existem)
- RLS de INSERT na `affiliate_withdrawals` já permite afiliados inserirem seus próprios saques
- O `payment_details` (jsonb) armazena `{ pix_key, pix_key_type, holder_name }`

