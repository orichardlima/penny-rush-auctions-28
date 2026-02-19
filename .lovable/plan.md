

# Plano: Separar Pedido de Pagamento de Contrato

## Problema Atual

Hoje, ao clicar em "Contratar Plano", o sistema cria imediatamente um registro na tabela `partner_contracts` com status PENDING -- mesmo antes do pagamento. Isso causa:

- Contratos "fantasma" que nunca foram pagos ficam poluindo o banco
- Se o usuario tenta novamente, pode perder o referral code e criar um segundo contrato sem vinculo de indicacao
- O trigger de posicionamento binaria (`auto_create_binary_position`) pode ser acionado indevidamente
- Confusao conceitual: um contrato so deveria existir apos o pagamento confirmado

## Solucao Proposta

Criar uma tabela intermediaria `partner_payment_intents` para armazenar os dados do pedido de pagamento (QR Code PIX). O contrato real so sera criado no webhook, apos confirmacao do Mercado Pago.

### Fluxo Novo

```text
ANTES (problematico):
  Usuario escolhe plano --> Cria CONTRATO (PENDING) --> Gera PIX --> Webhook ativa contrato
  
DEPOIS (correto):
  Usuario escolhe plano --> Cria PAYMENT INTENT --> Gera PIX --> Webhook cria CONTRATO (ACTIVE)
```

## Etapas de Implementacao

### 1. Criar tabela `partner_payment_intents`

Nova tabela para armazenar apenas a intencao de pagamento:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador do intent |
| user_id | uuid | Usuario que solicitou |
| plan_id | uuid | Plano escolhido |
| plan_name | text | Nome do plano (snapshot) |
| aporte_value | numeric | Valor do aporte |
| weekly_cap | numeric | Cap semanal (snapshot) |
| total_cap | numeric | Cap total (snapshot) |
| referral_code | text | Codigo de indicacao usado (se houver) |
| referred_by_user_id | uuid | User ID do indicador resolvido |
| payment_id | text | ID do pagamento no Mercado Pago |
| payment_status | text | pending, approved, rejected, expired |
| expires_at | timestamptz | Expiracao do QR Code |
| created_at | timestamptz | Data de criacao |

Nao precisara de triggers de posicionamento binario, pois nao e um contrato.

### 2. Alterar Edge Function `partner-payment`

Em vez de inserir na `partner_contracts`, inserir na `partner_payment_intents`:

- Verificar se ja existe contrato ACTIVE (manter essa validacao)
- Limpar intents expirados do mesmo usuario (evitar duplicatas)
- Resolver o `referred_by_user_id` a partir do `referralCode`
- Inserir na `partner_payment_intents`
- Gerar PIX no Mercado Pago com `external_reference` = ID do intent
- Retornar dados do QR Code para o frontend

### 3. Alterar Edge Function `partner-payment-webhook`

Na funcao `processNewContractPayment`:

- Buscar o `partner_payment_intents` pelo `payment_id` (em vez de `partner_contracts`)
- Se pagamento aprovado:
  - Criar o contrato real na `partner_contracts` com status ACTIVE e payment_status completed
  - Copiar os dados do intent (plan_name, aporte_value, caps, referred_by_user_id)
  - Gerar o referral_code unico neste momento
  - Creditar bonus de lances
  - O trigger `auto_create_binary_position` sera acionado corretamente porque o contrato ja nasce ACTIVE com `referred_by_user_id` preenchido
- Se pagamento rejeitado/cancelado:
  - Apenas atualizar o status do intent para `rejected`/`expired`
  - Nenhum contrato e criado
- Atualizar o intent com o status final

### 4. Alterar Frontend (minimo)

No `usePartnerContract.ts`:

- A funcao `createContract` passara a retornar `intentId` em vez de `contractId`
- O modal de PIX (`PartnerPixPaymentModal`) monitorara o status do intent (ou do contrato que sera criado)
- Apos pagamento confirmado, o frontend faz refresh para carregar o contrato real

No `PartnerPixPaymentModal.tsx`:

- Ajustar o listener Realtime para escutar mudancas na `partner_payment_intents` OU na `partner_contracts` (quando criado pelo webhook)

### 5. Verificacao de duplicidade (simplificada)

- Na edge function: checar se existe contrato ACTIVE (bloquear)
- Intents pendentes antigos (mais de 30 min) sao ignorados/limpos automaticamente
- O usuario pode gerar quantos intents quiser, so o primeiro pagamento aprovado gera contrato

## Beneficios

1. **Contrato so existe apos pagamento**: Elimina contratos fantasma
2. **Referral sempre preservado**: O intent guarda o referral desde a primeira tentativa
3. **Posicionamento binario correto**: O trigger so dispara quando o contrato nasce ACTIVE com todos os dados
4. **Sem duplicatas**: Intents expirados nao bloqueiam novas tentativas
5. **Auditoria limpa**: A tabela de contratos so contem contratos reais

## Secao Tecnica

### Arquivos modificados

| Arquivo | Tipo de mudanca |
|---------|----------------|
| Migration SQL | Criar tabela `partner_payment_intents` com RLS |
| `supabase/functions/partner-payment/index.ts` | Inserir em `payment_intents` em vez de `partner_contracts` |
| `supabase/functions/partner-payment-webhook/index.ts` | Buscar intent e criar contrato real no webhook |
| `src/hooks/usePartnerContract.ts` | Ajustar retorno (intentId) e verificacao de duplicidade |
| `src/components/Partner/PartnerPixPaymentModal.tsx` | Ajustar listener para nova tabela/fluxo |

### RLS da nova tabela

- Usuarios podem INSERT seus proprios intents
- Usuarios podem SELECT seus proprios intents
- Admins podem ALL
- Sem UPDATE/DELETE por usuarios comuns

### Compatibilidade

- Contratos ACTIVE existentes nao sao afetados
- O trigger `auto_create_binary_position` nao precisa ser alterado (ele ja verifica `status = 'ACTIVE'`)
- A verificacao na edge function contra contratos ACTIVE existentes permanece igual
