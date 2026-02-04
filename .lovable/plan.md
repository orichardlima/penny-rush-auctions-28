
## Plano: Integrar Pagamento PIX no Upgrade de Planos

### Problema Identificado

O sistema implementou PIX apenas para **novos contratos** (`createContract`), mas o **upgrade de plano** (`upgradeContract`) ainda atualiza o contrato **diretamente sem gerar pagamento**.

| Fluxo | Integração PIX | Status |
|-------|---------------|--------|
| Novo contrato | ✅ Gera QR Code, aguarda pagamento | Funcionando |
| Upgrade de plano | ❌ Atualiza direto, sem pagamento | **PROBLEMA** |

---

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/partner-upgrade-payment/index.ts` | **CRIAR** | Edge Function para gerar PIX do upgrade |
| `supabase/config.toml` | **MODIFICAR** | Registrar nova edge function |
| `src/hooks/usePartnerContract.ts` | **MODIFICAR** | Retornar dados PIX no `upgradeContract` |
| `src/components/Partner/PartnerUpgradeDialog.tsx` | **MODIFICAR** | Exibir modal PIX ao confirmar upgrade |
| `src/components/Partner/PartnerDashboard.tsx` | **MODIFICAR** | Adicionar handler para upgrade com pagamento |

---

### Novo Fluxo de Upgrade

```text
┌─────────────────┐    ┌───────────────────────┐    ┌─────────────────┐
│  Usuário        │───►│  Edge Function        │───►│  Mercado Pago   │
│  Confirma       │    │  partner-upgrade-pay  │    │  Gera PIX       │
│  Upgrade        │    └───────────────────────┘    └─────────────────┘
└─────────────────┘              │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  partner_pending_upgrades       │
                    │  (nova tabela para upgrades     │
                    │   pendentes de pagamento)       │
                    └─────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         ┌─────────────────┐       ┌─────────────────┐
         │  Modal PIX      │       │  Webhook MP     │
         │  QR Code        │       │  (já existente) │
         │  Diferença      │       └─────────────────┘
         └─────────────────┘                 │
                                             ▼
                                ┌─────────────────────────┐
                                │  Atualiza contrato com  │
                                │  novo plano e registra  │
                                │  na partner_upgrades    │
                                └─────────────────────────┘
```

---

### Detalhes Técnicos

#### 1. Nova Edge Function `partner-upgrade-payment`

Baseada na `partner-payment` existente:
- Recebe: `contractId`, `newPlanId`, `userId`, `userEmail`, `userName`
- Valida: contrato ativo, progresso < 80%, plano superior
- Calcula: `differenceToPay = newPlan.aporte_value - contract.aporte_value`
- Gera pagamento PIX no Mercado Pago com valor da diferença
- Armazena dados do upgrade pendente em metadata ou tabela
- Retorna QR Code e dados PIX

#### 2. Modificar Webhook Existente

O `partner-payment-webhook` já existente será estendido:
- Se `external_reference` contém prefixo de upgrade (ex: `upgrade_CONTRACT_ID_NEW_PLAN_ID`)
- Buscar contrato e novo plano
- Aplicar upgrade: atualizar `plan_name`, `aporte_value`, caps
- Registrar em `partner_upgrades`

#### 3. Modificar `upgradeContract` no Hook

Antes:
```typescript
// Atualiza direto no banco
await supabase.from('partner_contracts').update(...)
```

Depois:
```typescript
// Gera pagamento PIX
const { data } = await supabase.functions.invoke('partner-upgrade-payment', {...})
return { success: true, paymentData }
```

#### 4. Modificar `PartnerUpgradeDialog`

- Receber callback para abrir modal PIX
- Quando `onUpgrade` retornar `paymentData`, abrir modal
- Não fechar dialog até pagamento confirmado

#### 5. Modificar `PartnerDashboard`

- Criar estado para upgrade payment data
- Handler para upgrade que abre modal PIX
- Reutilizar `PartnerPixPaymentModal` existente

---

### Alternativa Simplificada (Recomendada)

Em vez de criar nova edge function, modificar a lógica para:

1. **Usar a mesma Edge Function de pagamento** com parâmetro adicional `isUpgrade: true`
2. **Passar dados do upgrade** no `external_reference`: `upgrade:{contractId}:{newPlanId}`
3. **Webhook detecta prefixo** e aplica upgrade em vez de ativar contrato

Isso reduz código duplicado e aproveita toda estrutura já implementada.

---

### Resultado Esperado

Após implementação:
- ✅ Usuário clica "Confirmar Upgrade" → Modal PIX com QR Code aparece
- ✅ Valor do PIX = diferença entre planos (ex: R$ 1.500,00 para PRO→Elite)
- ✅ Upgrade só aplicado após confirmação do pagamento
- ✅ Registro em `partner_upgrades` inclui `payment_id`
- ✅ Fluxo consistente com novos contratos
