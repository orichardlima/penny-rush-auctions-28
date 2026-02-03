

## Plano: Integrar Pagamento PIX nos Planos de Parceiro

### Situação Atual

Os planos de parceiro **não estão conectados** a nenhuma API de pagamento:

1. **Fluxo Atual**: Ao selecionar um plano, o contrato é criado imediatamente com `status: 'ACTIVE'`
2. **Arquivo**: `src/hooks/usePartnerContract.ts` → função `createContract()` (linhas 196-295)
3. **Problema**: O `aporte_value` é registrado, mas nenhuma transação PIX é gerada

---

### Recursos Já Disponíveis

| Recurso | Status |
|---------|--------|
| Edge Function `mercado-pago-payment` | ✅ Funcional (usada para pacotes de lances) |
| Edge Function `mercado-pago-webhook` | ✅ Funcional (confirma pagamentos automaticamente) |
| Componente `PixPaymentModal` | ✅ Funcional (QR Code + detecção automática) |
| Secret `MERCADO_PAGO_ACCESS_TOKEN` | ✅ Configurado |
| Tabela `partner_contracts` | ✅ Existe (adicionar campo `payment_status`) |

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/partner-payment/index.ts` | **CRIAR** | Edge Function para gerar PIX do plano de parceiro |
| `supabase/functions/partner-payment-webhook/index.ts` | **CRIAR** | Webhook para confirmar pagamento e ativar contrato |
| `supabase/config.toml` | **MODIFICAR** | Registrar novas edge functions |
| `src/hooks/usePartnerContract.ts` | **MODIFICAR** | Retornar dados PIX em vez de ativar direto |
| `src/components/Partner/PartnerPlanCard.tsx` | **MODIFICAR** | Adicionar loading state para pagamento |
| `src/components/Partner/PartnerDashboard.tsx` | **MODIFICAR** | Exibir modal PIX após seleção de plano |
| `src/components/Partner/PartnerPixPaymentModal.tsx` | **CRIAR** | Modal de pagamento PIX específico para parceiros |
| **Migração SQL** | **CRIAR** | Adicionar campo `payment_status` na tabela `partner_contracts` |

---

### Novo Fluxo de Contratação

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Usuário        │───►│  Edge Function   │───►│  Mercado Pago   │
│  Seleciona      │    │  partner-payment │    │  Gera PIX       │
│  Plano          │    └──────────────────┘    └─────────────────┘
└─────────────────┘              │
                                 ▼
                    ┌─────────────────────────┐
                    │  partner_contracts      │
                    │  status: 'PENDING'      │
                    │  payment_status: 'pending' │
                    └─────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         ┌─────────────────┐       ┌─────────────────┐
         │  Modal PIX      │       │  Webhook MP     │
         │  QR Code        │       │  Confirma       │
         │  Aguardando     │       │  Pagamento      │
         └─────────────────┘       └─────────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │  partner_contracts      │
                    │  status: 'ACTIVE'       │
                    │  payment_status: 'completed' │
                    └─────────────────────────┘
```

---

### Detalhes Técnicos

#### 1. Migração SQL

```sql
-- Adicionar status de pagamento nos contratos de parceiro
ALTER TABLE partner_contracts 
ADD COLUMN payment_status text DEFAULT 'completed';

ALTER TABLE partner_contracts 
ADD COLUMN payment_id text;

-- Atualizar contratos existentes como pagos (já estão ativos)
UPDATE partner_contracts 
SET payment_status = 'completed' 
WHERE payment_status IS NULL;
```

#### 2. Edge Function `partner-payment`

Baseada na `mercado-pago-payment` existente:
- Recebe: `planId`, `userId`, `userEmail`, `userName`, `referralCode`
- Cria contrato com `status: 'PENDING'` e `payment_status: 'pending'`
- Gera pagamento PIX no Mercado Pago com `aporte_value` do plano
- Retorna QR Code e dados PIX

#### 3. Edge Function `partner-payment-webhook`

Baseada na `mercado-pago-webhook` existente:
- Recebe notificação do Mercado Pago
- Busca contrato pelo `payment_id`
- Se aprovado: atualiza para `status: 'ACTIVE'` e `payment_status: 'completed'`
- Credita bônus de lances se o plano tiver
- Cria bônus de indicação em cascata (trigger já existe)

#### 4. Modal de Pagamento PIX

Componente similar ao `PixPaymentModal`:
- Exibe QR Code e código PIX copia-e-cola
- Detecção automática via Realtime + polling
- Exibe informações do plano selecionado
- Timeout de 30 minutos para pagamento

---

### Validações de Segurança

1. **Verificar plano existe e está ativo** antes de gerar pagamento
2. **Verificar usuário não tem contrato ativo** antes de permitir novo
3. **Idempotência**: Chave única para evitar pagamentos duplicados
4. **Validar assinatura do webhook** do Mercado Pago
5. **Não ativar contrato** até confirmação do pagamento

---

### Resultado Esperado

Após implementação:
- ✅ Usuário seleciona plano → Modal PIX aparece com QR Code
- ✅ Contrato criado com `status: 'PENDING'`
- ✅ Pagamento confirmado automaticamente via webhook
- ✅ Contrato ativado após confirmação (`status: 'ACTIVE'`)
- ✅ Bônus de lances creditados automaticamente
- ✅ Bônus de indicação criado para patrocinador

