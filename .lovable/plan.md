## Plano: Integrar Pagamento PIX nos Planos de Parceiro

### ✅ IMPLEMENTAÇÃO CONCLUÍDA

---

### Status das Tarefas

| Tarefa | Status |
|--------|--------|
| Migração SQL (payment_status, payment_id) | ✅ Concluído |
| Edge Function `partner-payment` | ✅ Concluído |
| Edge Function `partner-payment-webhook` | ✅ Concluído |
| Componente `PartnerPixPaymentModal` | ✅ Concluído |
| Atualização do hook `usePartnerContract` | ✅ Concluído |
| Atualização do `PartnerDashboard` | ✅ Concluído |
| Registro no `supabase/config.toml` | ✅ Concluído |

---

### Arquivos Criados/Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/partner-payment/index.ts` | **CRIADO** | Edge Function para gerar PIX do plano de parceiro |
| `supabase/functions/partner-payment-webhook/index.ts` | **CRIADO** | Webhook para confirmar pagamento e ativar contrato |
| `supabase/config.toml` | **MODIFICADO** | Registrado novas edge functions |
| `src/hooks/usePartnerContract.ts` | **MODIFICADO** | Retorna dados PIX em vez de ativar direto |
| `src/components/Partner/PartnerDashboard.tsx` | **MODIFICADO** | Exibe modal PIX após seleção de plano |
| `src/components/Partner/PartnerPixPaymentModal.tsx` | **CRIADO** | Modal de pagamento PIX específico para parceiros |

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

### Funcionalidades Implementadas

1. **Pagamento PIX via Mercado Pago**
   - QR Code + código copia-e-cola
   - Detecção automática via Realtime + polling
   - Timeout de 30 minutos

2. **Validações de Segurança**
   - Verificação de plano ativo
   - Verificação de contrato ativo/pendente existente
   - Chave de idempotência para evitar duplicatas
   - Validação de código de referral

3. **Ativação Automática**
   - Webhook do Mercado Pago atualiza contrato para ACTIVE
   - Credita bônus de lances automaticamente
   - Trigger existente cria bônus de indicação em cascata

---

### Próximos Passos (Opcional)

- [ ] Adicionar email de confirmação após ativação do contrato
- [ ] Adicionar notificação push quando contrato for ativado
- [ ] Implementar expiração de contratos pendentes após 24h sem pagamento
