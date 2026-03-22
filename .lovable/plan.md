

# Correção: Comissões de afiliado não criadas no webhook de pagamento

## Problema

O fluxo atual está assim:

```text
Frontend → asaas-payment (cria compra + comissão) → Asaas processa → partner-payment-webhook (aprova comissão)
```

O `partner-payment-webhook` na linha 262-284 **apenas aprova** comissões existentes. Se a comissão não foi criada no `asaas-payment` (por falha, referralCode ausente no localStorage, etc.), o pagamento é confirmado mas a comissão nunca é gerada.

No caso do Richard Lima: o "Teste comissão" está registrado como indicado (referral convertido), pagou R$15, mas a comissão simplesmente não existe na tabela `affiliate_commissions`.

## Solução

### 1. Arquivo: `supabase/functions/partner-payment-webhook/index.ts`

Na função `processBidPurchaseFallback`, após aprovar a compra e creditar lances (linha 260), adicionar lógica para **criar a comissão** quando não existir nenhuma:

- Se não existem comissões pendentes para esta compra (`purchase_id`)
- Buscar na tabela `affiliate_referrals` se o comprador foi indicado por algum afiliado
- Se sim, buscar dados do afiliado (taxa de comissão, status ativo)
- Verificar se é 1ª compra ou recompra
- Criar a comissão com status `approved` (pois o pagamento já foi confirmado)
- Atualizar `commission_balance` e `total_commission_earned` do afiliado

Essa lógica é essencialmente a mesma que existe no `asaas-payment` (linhas 300-370), mas adaptada para rodar no webhook.

### 2. Migration SQL: Corrigir o caso do Richard Lima

Criar a comissão manualmente para a compra `19e0bac1` do "Teste comissão":
- R$15 × 10% = R$1,50 de comissão
- Status: `approved`
- Atualizar `commission_balance` e `total_commission_earned` do afiliado

## Resultado

- Comissões serão criadas automaticamente no webhook mesmo que o frontend falhe em enviá-las
- Richard Lima receberá R$1,50 de comissão
- O "Histórico de Compras dos Indicados" passará a mostrar a compra

| Arquivo | Mudança |
|---|---|
| `supabase/functions/partner-payment-webhook/index.ts` | Adicionar criação de comissão quando não existir |
| Migration SQL | Creditar comissão do Richard Lima |

